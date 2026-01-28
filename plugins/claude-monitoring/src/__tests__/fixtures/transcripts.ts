/**
 * Sample transcripts and Gemini responses for testing
 */

/**
 * Sample JSONL transcript content for different scenarios
 */
export const SAMPLE_TRANSCRIPTS = {
  /** Japanese language conversation */
  japanese: `{"type":"user","message":{"role":"user","content":"今このディレクトリにPDFがあるのがわかると思う。bunでプロジェクトを立ち上げる"}}
{"type":"assistant","message":{"role":"assistant","content":"PDFファイルを確認して、bunプロジェクトを立ち上げます。"}}
{"type":"tool_use","tool":"Bash","input":{"command":"ls -la *.pdf"}}
{"type":"tool_result","output":"sample.pdf"}
{"type":"assistant","message":{"role":"assistant","content":"PDFファイルを確認しました。bunプロジェクトを初期化します。"}}`,

  /** English language conversation */
  english: `{"type":"user","message":{"role":"user","content":"I want to create a new React component for the dashboard"}}
{"type":"assistant","message":{"role":"assistant","content":"I'll help you create a new React component for the dashboard."}}
{"type":"tool_use","tool":"Write","input":{"path":"src/components/Dashboard.tsx"}}
{"type":"tool_result","output":"File created"}
{"type":"assistant","message":{"role":"assistant","content":"I've created the Dashboard component. Let me add the styling next."}}`,

  /** AskUserQuestion tool use for notification event */
  askUserQuestion: `{"type":"user","message":{"role":"user","content":"Help me set up the database"}}
{"type":"assistant","message":{"role":"assistant","content":"I'll help you set up the database. First, I need to know which database you'd like to use."}}
{"type":"tool_use","tool":"AskUserQuestion","input":{"question":"Which database would you like to use?","options":["PostgreSQL","MySQL","SQLite"]}}`,

  /** Bug fix conversation */
  bugFix: `{"type":"user","message":{"role":"user","content":"There's a bug in the login function"}}
{"type":"assistant","message":{"role":"assistant","content":"I'll investigate the login function bug."}}
{"type":"tool_use","tool":"Read","input":{"path":"src/auth/login.ts"}}
{"type":"tool_result","output":"function login(user, pass) { ... }"}
{"type":"assistant","message":{"role":"assistant","content":"Found the issue - the password validation was missing. I've fixed it."}}
{"type":"tool_use","tool":"Edit","input":{"path":"src/auth/login.ts"}}
{"type":"tool_result","output":"File edited"}`,

  /** Empty/minimal transcript */
  minimal: `{"type":"user","message":{"role":"user","content":"Hello"}}`,

  /** Long transcript (for testing tail reading) */
  long: Array.from(
    { length: 100 },
    (_, i) => `{"type":"assistant","message":{"role":"assistant","content":"Line ${i + 1}"}}`,
  ).join("\n"),
};

/**
 * Mock Gemini API response factories
 */
export const GEMINI_RESPONSES = {
  /** Create a successful response with the given summary text */
  success: (text: string) => ({
    candidates: [
      {
        content: {
          parts: [{ text }],
        },
      },
    ],
  }),

  /** Empty candidates array */
  empty: {
    candidates: [],
  },

  /** Candidates with no content */
  noContent: {
    candidates: [{}],
  },

  /** Candidates with empty parts */
  emptyParts: {
    candidates: [
      {
        content: {
          parts: [],
        },
      },
    ],
  },

  /** API error response */
  error: (message: string, code = 500) => ({
    error: {
      code,
      message,
      status: "INTERNAL",
    },
  }),
};

/**
 * Sample summaries for different scenarios
 */
export const SAMPLE_SUMMARIES = {
  japanese: "bunプロジェクトを初期化しました",
  english: "Created Dashboard React component",
  askQuestion: "Asking which database to use",
  bugFix: "Fixed password validation in login",
};
