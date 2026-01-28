import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { shouldNotifyStop } from "./dedup";

describe("dedup", () => {
  // Track state files created during tests for cleanup
  const createdStateFiles: string[] = [];

  function getStateFilePath(sessionId: string): string {
    return join(tmpdir(), `claude-monitoring-last-stop-${sessionId}`);
  }

  function createStateFile(sessionId: string, timestamp: number): void {
    const path = getStateFilePath(sessionId);
    writeFileSync(path, timestamp.toString());
    createdStateFiles.push(path);
  }

  afterEach(() => {
    // Clean up all state files created during tests
    for (const path of createdStateFiles) {
      if (existsSync(path)) {
        rmSync(path);
      }
    }
    createdStateFiles.length = 0;
  });

  describe("shouldNotifyStop", () => {
    it("should return true for first notification (no state file)", () => {
      const sessionId = `test-${Date.now()}-first`;
      createdStateFiles.push(getStateFilePath(sessionId));

      const result = shouldNotifyStop(sessionId);

      expect(result).toBe(true);
    });

    it("should create state file after returning true", () => {
      const sessionId = `test-${Date.now()}-create`;
      const statePath = getStateFilePath(sessionId);
      createdStateFiles.push(statePath);

      expect(existsSync(statePath)).toBe(false);

      shouldNotifyStop(sessionId);

      expect(existsSync(statePath)).toBe(true);
    });

    it("should return false for consecutive notifications within 30 seconds", () => {
      const sessionId = `test-${Date.now()}-consecutive`;
      createdStateFiles.push(getStateFilePath(sessionId));

      // First call - should return true
      const first = shouldNotifyStop(sessionId);
      expect(first).toBe(true);

      // Immediate second call - should return false (within 30 second window)
      const second = shouldNotifyStop(sessionId);
      expect(second).toBe(false);
    });

    it("should return true after 30 second window expires", () => {
      const sessionId = `test-${Date.now()}-expired`;
      const statePath = getStateFilePath(sessionId);
      createdStateFiles.push(statePath);

      // Create state file with timestamp 31 seconds ago
      const oldTimestamp = Date.now() - 31 * 1000;
      createStateFile(sessionId, oldTimestamp);

      const result = shouldNotifyStop(sessionId);

      expect(result).toBe(true);
    });

    it("should return false when timestamp is within 30 seconds", () => {
      const sessionId = `test-${Date.now()}-within`;
      const statePath = getStateFilePath(sessionId);
      createdStateFiles.push(statePath);

      // Create state file with timestamp 15 seconds ago
      const recentTimestamp = Date.now() - 15 * 1000;
      createStateFile(sessionId, recentTimestamp);

      const result = shouldNotifyStop(sessionId);

      expect(result).toBe(false);
    });

    it("should handle edge case at exactly 30 seconds", () => {
      const sessionId = `test-${Date.now()}-edge`;
      const statePath = getStateFilePath(sessionId);
      createdStateFiles.push(statePath);

      // Create state file with timestamp exactly 30 seconds ago
      const edgeTimestamp = Date.now() - 30 * 1000;
      createStateFile(sessionId, edgeTimestamp);

      // At exactly 30 seconds, window has elapsed (< 30000 is false)
      // so notification should happen
      const result = shouldNotifyStop(sessionId);
      expect(result).toBe(true);
    });

    it("should handle invalid timestamp in state file", () => {
      const sessionId = `test-${Date.now()}-invalid`;
      const statePath = getStateFilePath(sessionId);
      createdStateFiles.push(statePath);

      // Write invalid content to state file
      writeFileSync(statePath, "not-a-number");

      // Should proceed with notification when timestamp is invalid
      const result = shouldNotifyStop(sessionId);
      expect(result).toBe(true);
    });

    it("should update state file timestamp after returning true", () => {
      const sessionId = `test-${Date.now()}-update`;
      const statePath = getStateFilePath(sessionId);
      createdStateFiles.push(statePath);

      // Create state file with old timestamp
      const oldTimestamp = Date.now() - 60 * 1000;
      createStateFile(sessionId, oldTimestamp);

      // Should return true and update timestamp
      const result = shouldNotifyStop(sessionId);
      expect(result).toBe(true);

      // Immediately call again - should return false (timestamp was updated)
      const secondResult = shouldNotifyStop(sessionId);
      expect(secondResult).toBe(false);
    });

    it("should isolate state by session ID", () => {
      const sessionId1 = `test-${Date.now()}-session1`;
      const sessionId2 = `test-${Date.now()}-session2`;
      createdStateFiles.push(getStateFilePath(sessionId1));
      createdStateFiles.push(getStateFilePath(sessionId2));

      // First session notification
      const result1 = shouldNotifyStop(sessionId1);
      expect(result1).toBe(true);

      // Different session should still return true
      const result2 = shouldNotifyStop(sessionId2);
      expect(result2).toBe(true);

      // First session again should return false
      const result1Again = shouldNotifyStop(sessionId1);
      expect(result1Again).toBe(false);
    });
  });
});
