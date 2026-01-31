import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  sendMessage as dbSendMessage,
  getOrchestratorSession,
  type MessageContent,
  type MessageType,
  migrate,
} from "../../db/index.js";

export interface SendMessageArgs {
  orchestrator_id: string;
  message_type: MessageType;
  content: MessageContent;
  worker_id?: string;
}

/**
 * Sends a message from a worker to an orchestrator
 */
export function sendMessage(args: SendMessageArgs): CallToolResult {
  const { orchestrator_id, message_type, content, worker_id } = args;

  // Validate required parameters
  if (!orchestrator_id) {
    return {
      content: [{ type: "text", text: "Error: orchestrator_id is required" }],
      isError: true,
    };
  }

  if (!message_type) {
    return {
      content: [{ type: "text", text: "Error: message_type is required" }],
      isError: true,
    };
  }

  const validTypes: MessageType[] = ["task_complete", "task_failed", "question"];
  if (!validTypes.includes(message_type)) {
    return {
      content: [
        {
          type: "text",
          text: `Error: message_type must be one of: ${validTypes.join(", ")}`,
        },
      ],
      isError: true,
    };
  }

  if (!content || typeof content !== "object") {
    return {
      content: [
        {
          type: "text",
          text: "Error: content must be an object with at least a summary field",
        },
      ],
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

    const message = dbSendMessage({
      orchestrator_id,
      worker_id,
      message_type,
      content,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              message_id: message.id,
              orchestrator_id: message.orchestrator_id,
              message_type: message.message_type,
              status: message.status,
              created_at: message.created_at,
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
          text: `Error sending message: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}
