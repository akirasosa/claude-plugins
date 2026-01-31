import { existsSync, type FSWatcher, watch } from "node:fs";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DB_FILE } from "../../db/config.js";
import {
  pollMessages as dbPollMessages,
  getOrchestratorSession,
  type MessageContent,
  migrate,
} from "../../db/index.js";

// Constants
const DEFAULT_TIMEOUT_SECONDS = 300;
const MAX_TIMEOUT_SECONDS = 600;
const DEBOUNCE_MS = 100;
const FALLBACK_POLL_INTERVAL_MS = 30_000;
const DB_CHECK_INTERVAL_MS = 1_000;
const DB_WAIT_TIMEOUT_MS = 10_000;

export interface WaitForMessagesArgs {
  orchestrator_id: string;
  timeout_seconds?: number;
}

interface ParsedMessage {
  id: string;
  message_type: string;
  worker_id: string | null;
  content: MessageContent;
  created_at: string;
}

/**
 * Waits for the database file to exist
 */
async function waitForDatabase(): Promise<boolean> {
  if (existsSync(DB_FILE)) {
    return true;
  }

  const startTime = Date.now();
  while (Date.now() - startTime < DB_WAIT_TIMEOUT_MS) {
    await new Promise((resolve) => setTimeout(resolve, DB_CHECK_INTERVAL_MS));
    if (existsSync(DB_FILE)) {
      return true;
    }
  }
  return false;
}

/**
 * Checks for unread messages and returns them if any exist
 */
function checkForMessages(orchestratorId: string): ParsedMessage[] | null {
  const rawMessages = dbPollMessages(orchestratorId);
  if (rawMessages.length === 0) {
    return null;
  }

  return rawMessages.map((msg) => ({
    id: msg.id,
    message_type: msg.message_type,
    worker_id: msg.worker_id,
    content: JSON.parse(msg.content) as MessageContent,
    created_at: msg.created_at,
  }));
}

/**
 * Waits for worker messages to arrive. Blocks until messages received or timeout.
 * Uses fs.watch() for instant notification when the database changes.
 */
export async function waitForMessages(args: WaitForMessagesArgs): Promise<CallToolResult> {
  const { orchestrator_id } = args;
  let timeoutSeconds = args.timeout_seconds ?? DEFAULT_TIMEOUT_SECONDS;

  if (!orchestrator_id) {
    return {
      content: [{ type: "text", text: "Error: orchestrator_id is required" }],
      isError: true,
    };
  }

  // Cap timeout at maximum
  if (timeoutSeconds > MAX_TIMEOUT_SECONDS) {
    timeoutSeconds = MAX_TIMEOUT_SECONDS;
  }
  if (timeoutSeconds <= 0) {
    timeoutSeconds = DEFAULT_TIMEOUT_SECONDS;
  }

  const timeoutMs = timeoutSeconds * 1000;
  const startTime = Date.now();

  try {
    // Wait for database to exist
    const dbExists = await waitForDatabase();
    if (!dbExists) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "error",
                error: "Database does not exist and was not created within timeout",
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }

    // Ensure migrations are applied
    migrate();

    // Verify orchestrator exists
    const session = getOrchestratorSession(orchestrator_id);
    if (!session) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "error",
                error: `Orchestrator session not found: ${orchestrator_id}`,
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }

    // Check for existing messages first
    const existingMessages = checkForMessages(orchestrator_id);
    if (existingMessages) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "messages",
                orchestrator_id,
                message_count: existingMessages.length,
                messages: existingMessages,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    // Return a promise that resolves when messages arrive or timeout occurs
    return await new Promise<CallToolResult>((resolve) => {
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

      const handleMessages = (): void => {
        if (resolved) return;

        const messages = checkForMessages(orchestrator_id);
        if (messages) {
          resolved = true;
          cleanup();
          resolve({
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    status: "messages",
                    orchestrator_id,
                    message_count: messages.length,
                    messages,
                  },
                  null,
                  2,
                ),
              },
            ],
          });
        }
      };

      // Set up fs.watch with debounce
      try {
        watcher = watch(DB_FILE, { persistent: true }, () => {
          if (resolved) return;

          // Debounce rapid file changes
          if (debounceTimeout) {
            clearTimeout(debounceTimeout);
          }
          debounceTimeout = setTimeout(handleMessages, DEBOUNCE_MS);
        });

        watcher.on("error", () => {
          // Continue with fallback polling on error
        });
      } catch {
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
        resolve({
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "timeout",
                  orchestrator_id,
                  message: "No messages received within timeout period",
                },
                null,
                2,
              ),
            },
          ],
        });
        return;
      }

      timeoutTimer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve({
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    status: "timeout",
                    orchestrator_id,
                    message: "No messages received within timeout period",
                  },
                  null,
                  2,
                ),
              },
            ],
          });
        }
      }, remainingTime);
    });
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              status: "error",
              error: `Error waiting for messages: ${(error as Error).message}`,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }
}
