/**
 * Inbox system for orchestrator-worker communication
 *
 * Workers write completion messages to JSON inbox files;
 * orchestrators poll or check on-demand.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { InboxCheckResult, InboxFile, InboxMessage } from "./types";

/** Default inbox directory location */
const INBOX_DIR = join(homedir(), ".claude", "orchestrator-inbox");

/**
 * Ensure the inbox directory exists
 */
function ensureInboxDir(): void {
  if (!existsSync(INBOX_DIR)) {
    mkdirSync(INBOX_DIR, { recursive: true });
  }
}

/**
 * Get the inbox file path for a given orchestrator session
 */
function getInboxPath(orchestratorSessionId: string): string {
  return join(INBOX_DIR, `${orchestratorSessionId}.json`);
}

/**
 * Read the inbox file for a given orchestrator session
 * Returns empty inbox if file doesn't exist
 */
function readInbox(orchestratorSessionId: string): InboxFile {
  const path = getInboxPath(orchestratorSessionId);

  if (!existsSync(path)) {
    return { messages: [] };
  }

  try {
    const content = readFileSync(path, "utf-8");
    const parsed = JSON.parse(content) as InboxFile;
    // Ensure messages array exists
    if (!Array.isArray(parsed.messages)) {
      return { messages: [] };
    }
    return parsed;
  } catch {
    // Return empty inbox on parse error
    return { messages: [] };
  }
}

/**
 * Write the inbox file for a given orchestrator session
 */
function writeInbox(orchestratorSessionId: string, inbox: InboxFile): void {
  ensureInboxDir();
  const path = getInboxPath(orchestratorSessionId);
  writeFileSync(path, JSON.stringify(inbox, null, 2), "utf-8");
}

/**
 * Add a message to an orchestrator's inbox
 * Uses atomic write pattern to handle concurrent writes
 */
export function addMessage(
  orchestratorSessionId: string,
  message: Omit<InboxMessage, "timestamp">,
): void {
  // Read current inbox
  const inbox = readInbox(orchestratorSessionId);

  // Add new message with timestamp
  const fullMessage: InboxMessage = {
    ...message,
    timestamp: new Date().toISOString(),
    read: false,
  };
  inbox.messages.push(fullMessage);

  // Write back
  writeInbox(orchestratorSessionId, inbox);
}

/**
 * Check inbox for unread messages
 */
export function checkInbox(orchestratorSessionId: string): InboxCheckResult {
  const inbox = readInbox(orchestratorSessionId);
  const unreadMessages = inbox.messages.filter((m) => !m.read);

  return {
    unread_count: unreadMessages.length,
    messages: unreadMessages,
  };
}

/**
 * Mark all messages as read
 */
export function markAllRead(orchestratorSessionId: string): number {
  const inbox = readInbox(orchestratorSessionId);
  let markedCount = 0;

  for (const message of inbox.messages) {
    if (!message.read) {
      message.read = true;
      markedCount++;
    }
  }

  if (markedCount > 0) {
    writeInbox(orchestratorSessionId, inbox);
  }

  return markedCount;
}

/**
 * Mark a specific message as read by branch name
 */
export function markRead(orchestratorSessionId: string, workerBranch: string): boolean {
  const inbox = readInbox(orchestratorSessionId);
  let found = false;

  for (const message of inbox.messages) {
    if (message.worker_branch === workerBranch && !message.read) {
      message.read = true;
      found = true;
      break;
    }
  }

  if (found) {
    writeInbox(orchestratorSessionId, inbox);
  }

  return found;
}

/**
 * Clear all messages from inbox
 */
export function clearInbox(orchestratorSessionId: string): number {
  const inbox = readInbox(orchestratorSessionId);
  const count = inbox.messages.length;

  if (count > 0) {
    writeInbox(orchestratorSessionId, { messages: [] });
  }

  return count;
}

/**
 * Get all inbox files (for listing all orchestrator sessions)
 */
export function listInboxFiles(): string[] {
  ensureInboxDir();

  try {
    const { readdirSync } = require("node:fs");
    const files = readdirSync(INBOX_DIR) as string[];
    return files
      .filter((f: string) => f.endsWith(".json"))
      .map((f: string) => f.replace(".json", ""));
  } catch {
    return [];
  }
}

/**
 * Format inbox messages for display
 */
export function formatMessages(messages: InboxMessage[]): string {
  if (messages.length === 0) {
    return "No unread messages";
  }

  return messages
    .map((m, i) => {
      const prInfo = m.pr_url ? `PR: ${m.pr_url}` : m.pr_number ? `PR #${m.pr_number}` : "No PR";
      const summary = m.summary ? `\n   ${m.summary}` : "";
      const time = new Date(m.timestamp).toLocaleString();
      return `${i + 1}. [${m.worker_branch}] ${prInfo}${summary}\n   Time: ${time}`;
    })
    .join("\n\n");
}
