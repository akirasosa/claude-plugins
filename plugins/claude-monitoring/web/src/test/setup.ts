import { vi } from "vitest";

// Mock IndexedDB
const createMockObjectStore = () => ({
  get: vi.fn(() => ({ onsuccess: null, onerror: null, result: undefined })),
  put: vi.fn(() => ({ onsuccess: null, onerror: null })),
  delete: vi.fn(() => ({ onsuccess: null, onerror: null })),
  getAll: vi.fn(() => ({ onsuccess: null, onerror: null, result: [] })),
});

const createMockTransaction = () => ({
  objectStore: vi.fn(() => createMockObjectStore()),
  oncomplete: null,
  onerror: null,
});

const createMockDatabase = () => ({
  objectStoreNames: {
    contains: vi.fn(() => false),
  },
  createObjectStore: vi.fn(() => createMockObjectStore()),
  transaction: vi.fn(() => createMockTransaction()),
  close: vi.fn(),
});

const mockIndexedDBOpen = vi.fn(() => {
  const request = {
    result: createMockDatabase(),
    onsuccess: null as ((event: Event) => void) | null,
    onerror: null as ((event: Event) => void) | null,
    onupgradeneeded: null as ((event: Event) => void) | null,
  };

  // Simulate async success
  setTimeout(() => {
    if (request.onupgradeneeded) {
      request.onupgradeneeded(new Event("upgradeneeded"));
    }
    if (request.onsuccess) {
      request.onsuccess(new Event("success"));
    }
  }, 0);

  return request;
});

vi.stubGlobal("indexedDB", {
  open: mockIndexedDBOpen,
});

// Mock EventSource
class MockEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  readonly url: string;
  readyState = MockEventSource.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    // Simulate connection
    setTimeout(() => {
      this.readyState = MockEventSource.OPEN;
      if (this.onopen) {
        this.onopen(new Event("open"));
      }
    }, 0);
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
  }

  // Helper method for tests to simulate messages
  simulateMessage(data: string) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent("message", { data }));
    }
  }

  // Helper method for tests to simulate errors
  simulateError() {
    this.readyState = MockEventSource.CLOSED;
    if (this.onerror) {
      this.onerror(new Event("error"));
    }
  }
}

vi.stubGlobal("EventSource", MockEventSource);

// Mock fetch for API calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Export mocks for test access
export { MockEventSource, mockFetch, mockIndexedDBOpen };
