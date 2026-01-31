import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  pollMessages as dbPollMessages,
  getOrchestratorSession,
  type MessageContent,
  migrate,
} from "../../db/index.js";

export interface PollMessagesArgs {
  orchestrator_id: string;
}

/**
 * Polls for unread messages and marks them as read
 */
export function pollMessages(args: PollMessagesArgs): CallToolResult {
  const { orchestrator_id } = args;

  if (!orchestrator_id) {
    return {
      content: [{ type: "text", text: "Error: orchestrator_id is required" }],
      isError: true,
    };
  }

  try {
    // Ensure database is migrated
    migrate();

    // Verify orchestrator exists
    const orchestrator = getOrchestratorSession(orchestrator_id);
    if (!orchestrator) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Orchestrator session '${orchestrator_id}' not found`,
          },
        ],
        isError: true,
      };
    }

    const messages = dbPollMessages(orchestrator_id);

    // Parse content JSON for each message
    const parsedMessages = messages.map((msg) => ({
      id: msg.id,
      worker_id: msg.worker_id,
      message_type: msg.message_type,
      content: JSON.parse(msg.content) as MessageContent,
      created_at: msg.created_at,
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              orchestrator_id,
              message_count: parsedMessages.length,
              messages: parsedMessages,
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error polling messages: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}
