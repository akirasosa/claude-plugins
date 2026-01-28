/**
 * Fetch mock utilities for testing
 */

interface MockResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

interface GeminiSuccessResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

function mockFetch(response: MockResponse): typeof fetch {
  return async () => response as Response;
}

/**
 * Create a mock fetch that returns a successful Gemini API response
 */
export function mockGeminiSuccess(text: string): typeof fetch {
  const response: GeminiSuccessResponse = {
    candidates: [
      {
        content: {
          parts: [{ text }],
        },
      },
    ],
  };

  return mockFetch({
    ok: true,
    status: 200,
    json: async () => response,
    text: async () => JSON.stringify(response),
  });
}

/**
 * Create a mock fetch that returns an empty Gemini response (no candidates)
 */
export function mockGeminiEmpty(): typeof fetch {
  return mockFetch({
    ok: true,
    status: 200,
    json: async () => ({ candidates: [] }),
    text: async () => JSON.stringify({ candidates: [] }),
  });
}

/**
 * Create a mock fetch that returns a Gemini API error
 */
export function mockGeminiError(status = 500, message = "Internal Server Error"): typeof fetch {
  return mockFetch({
    ok: false,
    status,
    json: async () => ({ error: { message } }),
    text: async () => JSON.stringify({ error: { message } }),
  });
}

/**
 * Create a mock fetch that throws a network error
 */
export function mockFetchNetworkError(message = "Network error"): typeof fetch {
  return async () => {
    throw new Error(message);
  };
}
