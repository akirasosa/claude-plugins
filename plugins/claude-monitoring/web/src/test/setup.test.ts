import { describe, expect, it } from "vitest";
import { MockEventSource, mockFetch } from "./setup";

describe("Test Setup", () => {
  describe("MockEventSource", () => {
    it("should be available globally", () => {
      expect(EventSource).toBeDefined();
      expect(EventSource).toBe(MockEventSource);
    });

    it("should create instance with url", () => {
      const es = new EventSource("/api/events/stream");
      expect(es.url).toBe("/api/events/stream");
      expect(es.readyState).toBe(EventSource.CONNECTING);
    });
  });

  describe("IndexedDB", () => {
    it("should be mocked", () => {
      expect(indexedDB).toBeDefined();
      expect(indexedDB.open).toBeDefined();
    });
  });

  describe("fetch", () => {
    it("should be mocked", () => {
      expect(fetch).toBeDefined();
      expect(fetch).toBe(mockFetch);
    });
  });
});
