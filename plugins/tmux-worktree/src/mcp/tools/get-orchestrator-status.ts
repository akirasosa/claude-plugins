import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getOrchestratorStatus as dbGetOrchestratorStatus, migrate } from "../../db/index.js";

export interface GetOrchestratorStatusArgs {
  orchestrator_id: string;
}

/**
 * Gets the status of an orchestrator session including unread message count
 */
export function getOrchestratorStatus(args: GetOrchestratorStatusArgs): CallToolResult {
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

    const status = dbGetOrchestratorStatus(orchestrator_id);

    if (!status) {
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

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              ...status,
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
          text: `Error getting orchestrator status: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}
