import { type FSWatcher, watch } from "node:fs";
import { join } from "node:path";
import {
  cleanupDeadSessions,
  dbExists,
  deleteSession,
  type FilterMode,
  getActiveEvents,
  getCleanupCandidates,
  getDbLastModified,
  getDbPath,
  getSessionStatus,
  migrate,
} from "../src/db";

const DEFAULT_PORT = 3847;
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : DEFAULT_PORT;
const PUBLIC_DIR = join(import.meta.dir, "public");

// SSE clients
interface SSEClient {
  controller: ReadableStreamDefaultController;
  mode: FilterMode;
}
const clients: Set<SSEClient> = new Set();
let watcher: FSWatcher | null = null;
let debounceTimer: Timer | null = null;

// Check if a claude-monitoring server is already running on the port
async function isOurServerRunning(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}/api/events`, {
      signal: AbortSignal.timeout(1000),
    });
    if (response.ok) {
      const data = await response.json();
      // Check if it has our expected response structure
      return "events" in data && "last_modified" in data;
    }
  } catch {
    // Connection failed or timeout - server not running
  }
  return false;
}

function serializeEventsData(mode: FilterMode): string {
  return JSON.stringify({
    events: getActiveEvents(mode),
    last_modified: getDbLastModified(),
  });
}

function broadcastUpdate() {
  // Group clients by mode
  const clientsByMode = new Map<FilterMode, SSEClient[]>();
  for (const client of clients) {
    const modeClients = clientsByMode.get(client.mode) || [];
    modeClients.push(client);
    clientsByMode.set(client.mode, modeClients);
  }

  // Send appropriate data to each mode group
  for (const [mode, modeClients] of clientsByMode) {
    const data = serializeEventsData(mode);
    const message = `data: ${data}\n\n`;

    for (const client of modeClients) {
      try {
        client.controller.enqueue(new TextEncoder().encode(message));
      } catch {
        clients.delete(client);
      }
    }
  }
}

function startWatcher() {
  if (watcher) return;

  const dbPath = getDbPath();
  if (!dbExists()) {
    console.log("Database not found, will retry when accessed");
    return;
  }

  try {
    watcher = watch(dbPath, () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        broadcastUpdate();
      }, 100);
    });
    console.log(`Watching database: ${dbPath}`);
  } catch (err) {
    console.error("Failed to watch database:", err);
  }
}

function getContentType(path: string): string {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // API routes
  if (path === "/api/events") {
    const mode = (url.searchParams.get("mode") || "waiting") as FilterMode;
    return new Response(serializeEventsData(mode), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Delete session API
  if (path.match(/^\/api\/sessions\/[^/]+$/) && req.method === "DELETE") {
    const sessionId = path.split("/")[3];
    const success = deleteSession(sessionId);
    if (success) {
      // Broadcast update to all connected clients
      setTimeout(() => broadcastUpdate(), 50);
      return Response.json({ success: true });
    }
    return Response.json({ success: false, error: "Failed to delete session" }, { status: 500 });
  }

  // Session status API (for process tracking)
  if (path.match(/^\/api\/sessions\/[^/]+\/status$/) && req.method === "GET") {
    const sessionId = path.split("/")[3];
    return Response.json(getSessionStatus(sessionId));
  }

  // Cleanup preview API - returns sessions that would be deleted
  if (path === "/api/cleanup/preview" && req.method === "GET") {
    const candidates = getCleanupCandidates();
    return Response.json({
      count: candidates.length,
      sessions: candidates,
    });
  }

  // Cleanup API - performs bulk deletion of dead sessions
  if (path === "/api/cleanup" && req.method === "POST") {
    const result = cleanupDeadSessions();
    if (result.deleted_count > 0) {
      // Broadcast update to all connected clients
      setTimeout(() => broadcastUpdate(), 50);
    }
    return Response.json(result);
  }

  if (path === "/api/events/stream") {
    // Start watcher if not already started
    startWatcher();

    const mode = (url.searchParams.get("mode") || "waiting") as FilterMode;
    let client: SSEClient;

    const stream = new ReadableStream({
      start(controller) {
        client = { controller, mode };
        clients.add(client);

        // Send initial data
        controller.enqueue(new TextEncoder().encode(`data: ${serializeEventsData(mode)}\n\n`));
      },
      cancel() {
        clients.delete(client);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Static files
  let filePath: string;
  if (path === "/" || path === "/index.html") {
    filePath = join(PUBLIC_DIR, "index.html");
  } else if (path.startsWith("/static/")) {
    filePath = join(PUBLIC_DIR, path.slice(8));
  } else {
    filePath = join(PUBLIC_DIR, path);
  }

  const file = Bun.file(filePath);
  if (await file.exists()) {
    return new Response(file, {
      headers: { "Content-Type": getContentType(filePath) },
    });
  }

  return new Response("Not Found", { status: 404 });
}

// Main startup
async function main() {
  // Initialize database and run migrations
  try {
    migrate();
  } catch {
    // Ignore migration errors during startup
  }

  // Check if our server is already running on the target port
  if (await isOurServerRunning(PORT)) {
    console.log(`Claude Monitoring Web UI already running at http://localhost:${PORT}`);
    process.exit(0);
  }

  // Start server
  let server: ReturnType<typeof Bun.serve>;
  try {
    server = Bun.serve({
      port: PORT,
      fetch: handleRequest,
      idleTimeout: 255, // Max value for SSE connections
    });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "EADDRINUSE") {
      // Port in use by another application, try a different port
      console.error(`Port ${PORT} is in use by another application`);
      server = Bun.serve({
        port: 0,
        fetch: handleRequest,
        idleTimeout: 255,
      });
    } else {
      throw err;
    }
  }

  console.log(`Claude Monitoring Web UI running at http://localhost:${server.port}`);

  // Start watcher on startup
  startWatcher();
}

main();
