import { join } from "path";
import { homedir } from "os";

export const DB_DIR = join(homedir(), ".local/share/claude-monitoring");
export const DB_FILE = join(DB_DIR, "events.db");
export const RETENTION_DAYS = 30;
