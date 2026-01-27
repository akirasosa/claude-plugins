#!/usr/bin/env bun
import { execSync } from "child_process";
import {
  migrate,
  checkMigrations,
  cleanup,
  recordEvent,
  getTmuxWindowIdForSession,
  type EventInput,
} from "./db";

const USAGE = `
Usage: claude-monitoring <command> [args]

Commands:
  migrate        Run pending database migrations
  migrate:check  Check for pending migrations (exit 1 if pending)
  cleanup        Delete old records based on retention policy
  event-log      Record an event (stdin: JSON with session_id, cwd)
                 Usage: echo '{"session_id":"...","cwd":"..."}' | claude-monitoring event-log <event_type> [summary]
  init           Initialize database (run migrations)
  help           Show this help message
`;

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  const reader = Bun.stdin.stream().getReader();

  // Set a timeout for reading stdin
  const timeoutPromise = new Promise<string>((resolve) => {
    setTimeout(() => resolve("{}"), 5000);
  });

  const readPromise = (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      return new TextDecoder().decode(Buffer.concat(chunks));
    } catch {
      return "{}";
    }
  })();

  return Promise.race([readPromise, timeoutPromise]);
}

function getTmuxWindowId(): string | null {
  if (!process.env.TMUX) {
    return null;
  }
  try {
    return execSync("tmux display-message -p '#{window_id}'", {
      encoding: "utf-8",
      timeout: 1000,
    }).trim();
  } catch {
    return null;
  }
}

function getGitBranch(projectDir: string | undefined): string | null {
  if (!projectDir) {
    return null;
  }
  try {
    return execSync(`git -C "${projectDir}" rev-parse --abbrev-ref HEAD`, {
      encoding: "utf-8",
      timeout: 1000,
    }).trim();
  } catch {
    return null;
  }
}

async function handleEventLog(args: string[]): Promise<void> {
  const eventType = args[0] || "unknown";
  const summary = args[1] || "";

  const inputJson = await readStdin();
  let input: EventInput;
  try {
    input = JSON.parse(inputJson);
  } catch {
    input = {};
  }

  // Ensure migrations are run
  try {
    migrate();
  } catch {
    // Ignore migration errors during event logging
  }

  // Determine tmux window ID
  let tmuxWindowId: string | null = null;
  if (process.env.TMUX) {
    if (eventType === "SessionStart") {
      // For SessionStart, capture current window
      tmuxWindowId = getTmuxWindowId();
    } else if (input.session_id) {
      // For other events, try to get from SessionStart event
      tmuxWindowId = getTmuxWindowIdForSession(input.session_id);
      // Fallback to current window
      if (!tmuxWindowId) {
        tmuxWindowId = getTmuxWindowId();
      }
    }
  }

  // Get git branch
  const gitBranch = getGitBranch(input.cwd);

  recordEvent({
    eventType,
    summary,
    input,
    tmuxWindowId,
    gitBranch,
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "migrate":
      migrate();
      break;

    case "migrate:check": {
      const result = checkMigrations();
      if (result.pending > 0) {
        process.exit(1);
      }
      break;
    }

    case "cleanup":
      cleanup();
      break;

    case "event-log":
      await handleEventLog(args.slice(1));
      break;

    case "init":
      migrate();
      console.log("Database initialized");
      break;

    case "help":
    case "--help":
    case "-h":
      console.log(USAGE);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.log(USAGE);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
