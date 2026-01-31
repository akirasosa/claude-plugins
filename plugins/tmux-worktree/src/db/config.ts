import { homedir } from "node:os";
import { join } from "node:path";

export const DB_DIR = join(homedir(), ".local/share/tmux-worktree");
export const DB_FILE = join(DB_DIR, "messages.db");

// Default retention: 7 days, configurable via environment variable
export const RETENTION_DAYS = Number.parseInt(process.env.TMUX_WORKTREE_RETENTION_DAYS || "7", 10);
