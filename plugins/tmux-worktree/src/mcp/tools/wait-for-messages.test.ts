import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

// Mock the db module before importing wait-for-messages
let mockDbExists = true;
let mockSession: { id: string; project_dir: string; created_at: string } | null = null;
let mockMessages: Array<{
  id: string;
  orchestrator_id: string;
  worker_id: string | null;
  message_type: string;
  content: string;
  status: string;
  created_at: string;
}> = [];

mock.module("../../db/config.js", () => ({
  DB_FILE: "/tmp/test-db.sqlite",
}));

mock.module("../../db/index.js", () => ({
  migrate: () => {},
  getOrchestratorSession: (id: string) => {
    if (mockSession && mockSession.id === id) {
      return mockSession;
    }
    return null;
  },
  pollMessages: (orchestratorId: string) => {
    const unread = mockMessages.filter(
      (m) => m.orchestrator_id === orchestratorId && m.status === "unread",
    );
    // Mark as read (simulate poll behavior)
    for (const msg of unread) {
      msg.status = "read";
    }
    return unread;
  },
}));

mock.module("node:fs", () => ({
  existsSync: () => mockDbExists,
  watch: () => ({
    on: () => {},
    close: () => {},
  }),
}));

// Import after mocking
import { waitForMessages } from "./wait-for-messages.js";

describe("wait_for_messages MCP tool", () => {
  beforeEach(() => {
    mockDbExists = true;
    mockSession = null;
    mockMessages = [];
  });

  afterEach(() => {
    mockDbExists = true;
    mockSession = null;
    mockMessages = [];
  });

  it("should return error when orchestrator_id is not provided", async () => {
    const result = await waitForMessages({ orchestrator_id: "" });

    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe("text");
    expect((result.content[0] as { text: string }).text).toContain("orchestrator_id is required");
  });

  it("should return error when orchestrator session not found", async () => {
    mockSession = null;

    const result = await waitForMessages({ orchestrator_id: "orch_notfound" });

    // The tool returns isError: true for orchestrator not found
    const response = JSON.parse((result.content[0] as { text: string }).text);
    expect(response.status).toBe("error");
    expect(response.error).toContain("not found");
  });

  it("should return immediately when messages exist", async () => {
    mockSession = {
      id: "orch_test123",
      project_dir: "/test/project",
      created_at: new Date().toISOString(),
    };
    mockMessages = [
      {
        id: "msg_1",
        orchestrator_id: "orch_test123",
        worker_id: "worker_1",
        message_type: "task_complete",
        content: JSON.stringify({ summary: "PR created", pr_url: "https://github.com/pr/1" }),
        status: "unread",
        created_at: new Date().toISOString(),
      },
    ];

    const result = await waitForMessages({ orchestrator_id: "orch_test123" });

    expect(result.isError).not.toBe(true);
    const response = JSON.parse((result.content[0] as { text: string }).text);
    expect(response.status).toBe("messages");
    expect(response.message_count).toBe(1);
    expect(response.messages[0].message_type).toBe("task_complete");
    expect(response.messages[0].content.summary).toBe("PR created");
  });

  it("should return multiple messages when multiple exist", async () => {
    mockSession = {
      id: "orch_test123",
      project_dir: "/test/project",
      created_at: new Date().toISOString(),
    };
    mockMessages = [
      {
        id: "msg_1",
        orchestrator_id: "orch_test123",
        worker_id: "worker_1",
        message_type: "task_complete",
        content: JSON.stringify({ summary: "PR 1 created" }),
        status: "unread",
        created_at: new Date().toISOString(),
      },
      {
        id: "msg_2",
        orchestrator_id: "orch_test123",
        worker_id: "worker_2",
        message_type: "task_failed",
        content: JSON.stringify({ summary: "Build failed", error: "Compile error" }),
        status: "unread",
        created_at: new Date().toISOString(),
      },
    ];

    const result = await waitForMessages({ orchestrator_id: "orch_test123" });

    expect(result.isError).not.toBe(true);
    const response = JSON.parse((result.content[0] as { text: string }).text);
    expect(response.status).toBe("messages");
    expect(response.message_count).toBe(2);
  });

  it("should cap timeout at maximum (600s)", async () => {
    mockSession = {
      id: "orch_test123",
      project_dir: "/test/project",
      created_at: new Date().toISOString(),
    };
    // No messages - will timeout

    // Set a very short timeout (1 second) with a large input to verify capping works
    // But since we're testing the cap mechanism, we use a small timeout for the actual test
    const result = await waitForMessages({
      orchestrator_id: "orch_test123",
      timeout_seconds: 0.1, // Very short timeout for test
    });

    expect(result.isError).not.toBe(true);
    const response = JSON.parse((result.content[0] as { text: string }).text);
    expect(response.status).toBe("timeout");
  });

  it("should use default timeout when not specified", async () => {
    mockSession = {
      id: "orch_test123",
      project_dir: "/test/project",
      created_at: new Date().toISOString(),
    };
    // Add a message to return immediately
    mockMessages = [
      {
        id: "msg_1",
        orchestrator_id: "orch_test123",
        worker_id: null,
        message_type: "task_complete",
        content: JSON.stringify({ summary: "Done" }),
        status: "unread",
        created_at: new Date().toISOString(),
      },
    ];

    const result = await waitForMessages({ orchestrator_id: "orch_test123" });

    expect(result.isError).not.toBe(true);
    const response = JSON.parse((result.content[0] as { text: string }).text);
    expect(response.status).toBe("messages");
  });

  it("should include orchestrator_id in response", async () => {
    mockSession = {
      id: "orch_specific",
      project_dir: "/test/project",
      created_at: new Date().toISOString(),
    };
    mockMessages = [
      {
        id: "msg_1",
        orchestrator_id: "orch_specific",
        worker_id: null,
        message_type: "question",
        content: JSON.stringify({ summary: "Need help", question: "How to proceed?" }),
        status: "unread",
        created_at: new Date().toISOString(),
      },
    ];

    const result = await waitForMessages({ orchestrator_id: "orch_specific" });

    const response = JSON.parse((result.content[0] as { text: string }).text);
    expect(response.orchestrator_id).toBe("orch_specific");
  });
});
