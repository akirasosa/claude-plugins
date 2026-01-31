#!/usr/bin/env bun
/**
 * wait-for-message CLI
 *
 * Waits for messages to arrive for the specified orchestrator.
 * Uses fs.watch() for instant notification when the database changes.
 *
 * Usage:
 *   bun run wait-for-message.ts --orchestrator-id=orch_xxx [--timeout=300]
 *
 * Exit codes:
 *   0 - Messages received or timeout reached
 *   1 - Error (orchestrator not found, invalid args, etc.)
 */

import { existsSync, type FSWatcher, watch } from "node:fs";
import { parseArgs } from "node:util";
import { DB_FILE } from "../../src/db/config.js";
import { getOrchestratorSession, migrate, pollMessages } from "../../src/db/index.js";

// Constants
const DEFAULT_TIMEOUT_SECONDS = 300;
const DEBOUNCE_MS = 100;
const FALLBACK_POLL_INTERVAL_MS = 30_000;
const DB_CHECK_INTERVAL_MS = 1_000;

interface WaitResult {
  status: "messages" | "timeout" | "error";
  messages?: Array<{
    id: string;
    message_type: string;
    worker_id: string | null;
    content: unknown;
    created_at: string;
  }>;
  error?: string;
}

function parseArguments(): { orchestratorId: string; timeoutSeconds: number } {
  try {
    const { values } = parseArgs({
      options: {
        "orchestrator-id": { type: "string" },
        timeout: { type: "string" },
      },
      strict: true,
    });

    const orchestratorId = values["orchestrator-id"];
    if (!orchestratorId) {
      console.error("Error: --orchestrator-id is required");
      process.exit(1);
    }

    const timeoutSeconds = values.timeout
      ? Number.parseInt(values.timeout, 10)
      : DEFAULT_TIMEOUT_SECONDS;

    if (Number.isNaN(timeoutSeconds) || timeoutSeconds <= 0) {
      console.error("Error: --timeout must be a positive integer");
      process.exit(1);
    }

    return { orchestratorId, timeoutSeconds };
  } catch (error) {
    console.error(`Error parsing arguments: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

function outputResult(result: WaitResult): void {
  console.log(JSON.stringify(result, null, 2));
}

async function waitForDatabase(): Promise<boolean> {
  // If database exists, return immediately
  if (existsSync(DB_FILE)) {
    return true;
  }

  // Wait for database to be created (up to 10 seconds)
  const maxWait = 10_000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    await new Promise((resolve) => setTimeout(resolve, DB_CHECK_INTERVAL_MS));
    if (existsSync(DB_FILE)) {
      return true;
    }
  }

  return false;
}

async function checkForMessages(orchestratorId: string): Promise<WaitResult["messages"] | null> {
  const rawMessages = pollMessages(orchestratorId);
  if (rawMessages.length === 0) {
    return null;
  }

  return rawMessages.map((msg) => ({
    id: msg.id,
    message_type: msg.message_type,
    worker_id: msg.worker_id,
    content: JSON.parse(msg.content),
    created_at: msg.created_at,
  }));
}

async function main(): Promise<void> {
  const { orchestratorId, timeoutSeconds } = parseArguments();
  const timeoutMs = timeoutSeconds * 1000;
  const startTime = Date.now();

  // Wait for database to exist
  const dbExists = await waitForDatabase();
  if (!dbExists) {
    outputResult({
      status: "error",
      error: "Database does not exist and was not created within timeout",
    });
    process.exit(1);
  }

  // Ensure migrations are applied
  migrate();

  // Verify orchestrator exists
  const session = getOrchestratorSession(orchestratorId);
  if (!session) {
    outputResult({
      status: "error",
      error: `Orchestrator session not found: ${orchestratorId}`,
    });
    process.exit(1);
  }

  // Check for existing messages first
  const existingMessages = await checkForMessages(orchestratorId);
  if (existingMessages) {
    outputResult({
      status: "messages",
      messages: existingMessages,
    });
    process.exit(0);
  }

  // Set up cleanup
  let watcher: FSWatcher | null = null;
  let fallbackInterval: ReturnType<typeof setInterval> | null = null;
  let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  let resolved = false;

  const cleanup = (): void => {
    if (watcher) {
      watcher.close();
      watcher = null;
    }
    if (fallbackInterval) {
      clearInterval(fallbackInterval);
      fallbackInterval = null;
    }
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
      debounceTimeout = null;
    }
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }
  };

  const handleMessages = async (): Promise<void> => {
    if (resolved) return;

    const messages = await checkForMessages(orchestratorId);
    if (messages) {
      resolved = true;
      cleanup();
      outputResult({
        status: "messages",
        messages,
      });
      process.exit(0);
    }
  };

  // Set up fs.watch with debounce
  try {
    watcher = watch(DB_FILE, { persistent: true }, (_eventType) => {
      if (resolved) return;

      // Debounce rapid file changes
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      debounceTimeout = setTimeout(() => {
        handleMessages();
      }, DEBOUNCE_MS);
    });

    watcher.on("error", (error) => {
      console.error(`fs.watch error: ${error.message}`);
      // Continue with fallback polling
    });
  } catch (error) {
    console.error(`Failed to set up fs.watch: ${error instanceof Error ? error.message : error}`);
    // Continue with fallback polling only
  }

  // Set up fallback polling (in case fs.watch misses events)
  fallbackInterval = setInterval(() => {
    if (!resolved) {
      handleMessages();
    }
  }, FALLBACK_POLL_INTERVAL_MS);

  // Set up timeout
  const remainingTime = timeoutMs - (Date.now() - startTime);
  if (remainingTime <= 0) {
    cleanup();
    outputResult({ status: "timeout" });
    process.exit(0);
  }

  timeoutTimer = setTimeout(() => {
    if (!resolved) {
      resolved = true;
      cleanup();
      outputResult({ status: "timeout" });
      process.exit(0);
    }
  }, remainingTime);

  // Handle process signals
  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error(`Fatal error: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
