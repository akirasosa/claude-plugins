import { watch, type FSWatcher } from "fs";
import { join } from "path";
import { getActiveEvents, getDbLastModified, getDbPath, dbExists } from "./db";

const DEFAULT_PORT = 3847;
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : DEFAULT_PORT;
const PUBLIC_DIR = join(import.meta.dir, "public");

// SSE clients
const clients: Set<ReadableStreamDefaultController> = new Set();
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

function broadcastUpdate() {
  const data = JSON.stringify({
    events: getActiveEvents(),
    last_modified: getDbLastModified(),
  });
  const message = `data: ${data}\n\n`;

  for (const controller of clients) {
    try {
      controller.enqueue(new TextEncoder().encode(message));
    } catch {
      clients.delete(controller);
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
  return "application/octet-stream";
}

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // API routes
  if (path === "/api/events") {
    return Response.json({
      events: getActiveEvents(),
      last_modified: getDbLastModified(),
    });
  }

  if (path === "/api/events/stream") {
    // Start watcher if not already started
    startWatcher();

    const stream = new ReadableStream({
      start(controller) {
        clients.add(controller);

        // Send initial data
        const data = JSON.stringify({
          events: getActiveEvents(),
          last_modified: getDbLastModified(),
        });
        controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
      },
      cancel(controller) {
        clients.delete(controller);
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
