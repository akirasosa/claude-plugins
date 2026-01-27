#!/usr/bin/env bun
import { execSync } from "child_process";
import {
  migrate,
  checkMigrations,
  cleanup,
  recordEvent,
  getTmuxWindowIdForSession,
  getActiveEvents,
  type EventInput,
  type EventResponse,
} from "./db";
import {
  handleEvent,
  type EventType,
  type NotificationInput,
} from "./notification";

const USAGE = `
Usage: claude-monitoring <command> [args]

Commands:
  migrate        Run pending database migrations
  migrate:check  Check for pending migrations (exit 1 if pending)
  cleanup        Delete old records based on retention policy
  event-log      Record an event (stdin: JSON with session_id, cwd)
                 Usage: echo '{"session_id":"...","cwd":"..."}' | claude-monitoring event-log <event_type> [summary]
  notification   Handle Claude Code hook events (stop, notification, sessionstart, sessionend)
                 Usage: echo '{"session_id":"...","cwd":"...","transcript_path":"..."}' | claude-monitoring notification <event_type>
  sessions       List active sessions
                 Options: --format json|table (default: json)
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
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

function getProjectName(projectDir: string | undefined): string | null {
  if (!projectDir) {
    return null;
  }
  try {
    const remoteUrl = execSync(`git -C "${projectDir}" remote get-url origin`, {
      encoding: "utf-8",
      timeout: 1000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    // Parse SSH URL: git@github.com:user/repo.git -> repo
    const sshMatch = remoteUrl.match(/[:/]([^/]+?)(?:\.git)?$/);
    if (sshMatch) {
      return sshMatch[1].replace(/\.git$/, "");
    }

    // Parse HTTPS URL: https://github.com/user/repo.git -> repo
    const httpsMatch = remoteUrl.match(/\/([^/]+?)(?:\.git)?$/);
    if (httpsMatch) {
      return httpsMatch[1].replace(/\.git$/, "");
    }

    return null;
  } catch {
    return null;
  }
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function handleSessions(args: string[]): void {
  const formatArg = args.find((arg) => arg.startsWith("--format="));
  const formatIndex = args.indexOf("--format");
  let format = "json";

  if (formatArg) {
    format = formatArg.split("=")[1];
  } else if (formatIndex !== -1 && args[formatIndex + 1]) {
    format = args[formatIndex + 1];
  }

  // Ensure migrations are run
  try {
    migrate();
  } catch {
    // Ignore migration errors
  }

  const sessions = getActiveEvents("waiting");

  if (format === "table") {
    if (sessions.length === 0) {
      console.log("No active sessions found.");
      return;
    }
    console.log(
      "| Project | Status | Time | Branch | Summary | Jump |"
    );
    console.log("|---------|--------|------|--------|---------|------|");
    for (const s of sessions) {
      const project = s.project_name;
      const status = s.event_type;
      const time = formatTime(s.created_at);
      const branch = s.git_branch || "-";
      const summary = s.summary.length > 30 ? s.summary.slice(0, 27) + "..." : s.summary;
      const jump = s.tmux_command ? `\`${s.tmux_command}\`` : "-";
      console.log(`| ${project} | ${status} | ${time} | ${branch} | ${summary} | ${jump} |`);
    }
  } else {
    console.log(JSON.stringify(sessions, null, 2));
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

  // Get git branch and project name
  const gitBranch = getGitBranch(input.cwd);
  const projectName = getProjectName(input.cwd);

  recordEvent({
    eventType,
    summary,
    input,
    tmuxWindowId,
    gitBranch,
    projectName,
  });
}

async function handleNotificationCommand(args: string[]): Promise<void> {
  const isBackground = args.includes("--background");

  if (isBackground) {
    // Background mode: input is passed as base64-encoded argument
    const eventType = (args[0] || "notification") as EventType;
    const inputBase64 = args.find((a) => a.startsWith("--input="))?.slice(8);
    let input: NotificationInput;
    try {
      input = JSON.parse(Buffer.from(inputBase64 || "", "base64").toString());
    } catch {
      input = {};
    }

    // Ensure migrations are run
    try {
      migrate();
    } catch {
      // Ignore migration errors during event handling
    }

    // Create a logToDb function that uses recordEvent
    const logToDb = (evtType: string, summary: string): void => {
      let tmuxWindowId: string | null = null;
      if (process.env.TMUX) {
        if (evtType === "SessionStart") {
          tmuxWindowId = getTmuxWindowId();
        } else if (input.session_id) {
          tmuxWindowId = getTmuxWindowIdForSession(input.session_id);
          if (!tmuxWindowId) {
            tmuxWindowId = getTmuxWindowId();
          }
        }
      }

      const gitBranch = getGitBranch(input.cwd);
      const projectName = getProjectName(input.cwd);

      recordEvent({
        eventType: evtType,
        summary,
        input: {
          session_id: input.session_id,
          cwd: input.cwd,
        },
        tmuxWindowId,
        gitBranch,
        projectName,
      });
    };

    await handleEvent(eventType, input, logToDb);
  } else {
    // Foreground mode: read stdin, spawn background process, exit immediately
    const eventType = args[0] || "notification";
    const inputJson = await readStdin();
    const inputBase64 = Buffer.from(inputJson).toString("base64");

    // Spawn ourselves in background mode
    const proc = Bun.spawn(
      ["bun", "run", import.meta.path, "notification", eventType, "--background", `--input=${inputBase64}`],
      {
        stdout: "ignore",
        stderr: "ignore",
        stdin: "ignore",
      }
    );
    proc.unref();
  }
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

    case "notification":
      await handleNotificationCommand(args.slice(1));
      break;

    case "sessions":
      handleSessions(args.slice(1));
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
