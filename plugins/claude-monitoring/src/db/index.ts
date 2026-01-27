// Config
export { DB_DIR, DB_FILE, RETENTION_DAYS } from "./config";

// Database operations
export {
  getDbPath,
  dbExists,
  ensureDbDir,
  getDb,
  getActiveEvents,
  getDbLastModified,
  endSession,
  recordEvent,
  getTmuxWindowIdForSession,
  type RecordEventOptions,
} from "./database";

// Migrations
export { migrate, checkMigrations, type MigrateResult } from "./migrations";

// Cleanup
export { cleanup, type CleanupResult } from "./cleanup";

// Re-export types
export type { Event, EventInput, EventResponse, FilterMode } from "../types";
