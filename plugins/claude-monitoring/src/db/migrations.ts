import { Database } from "bun:sqlite";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { DB_FILE } from "./config";
import { ensureDbDir, dbExists } from "./database";

function getMigrationsDir(): string {
  // When compiled, process.execPath gives the actual binary path
  // When running from source, import.meta.dir works
  const isCompiled = import.meta.path.startsWith("/$bunfs/");

  if (isCompiled) {
    // process.execPath is the actual binary location (e.g., /path/to/bin/claude-monitoring)
    const binDir = dirname(process.execPath);
    return join(dirname(binDir), "scripts", "migrations");
  }

  // Running from source (src/db/migrations.ts -> scripts/migrations)
  return join(dirname(dirname(import.meta.dir)), "scripts", "migrations");
}

function getDbVersion(db: Database): number {
  try {
    const result = db.query("PRAGMA user_version").get() as { user_version: number };
    return result.user_version;
  } catch {
    return 0;
  }
}

function setDbVersion(db: Database, version: number): void {
  db.exec(`PRAGMA user_version = ${version}`);
}

function tableExists(db: Database, tableName: string): boolean {
  const result = db.query(
    "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name=?"
  ).get(tableName) as { count: number };
  return result.count > 0;
}

function columnExists(db: Database, tableName: string, columnName: string): boolean {
  const result = db.query(
    `SELECT count(*) as count FROM pragma_table_info('${tableName}') WHERE name=?`
  ).get(columnName) as { count: number };
  return result.count > 0;
}

function detectExistingVersion(db: Database): number {
  if (!tableExists(db, "events")) {
    return 0;
  }

  // Check for migration 004: tmux_session column removed
  if (!columnExists(db, "events", "tmux_session")) {
    return 4;
  }
  // Check for migration 003: tmux_window_id added
  if (columnExists(db, "events", "tmux_window_id")) {
    return 3;
  }
  // Check for migration 002: git_branch added
  if (columnExists(db, "events", "git_branch")) {
    return 2;
  }
  // Migration 001: initial schema
  return 1;
}

function getMigrationVersion(filename: string): number {
  const match = filename.match(/^(\d+)_/);
  return match ? parseInt(match[1], 10) : 0;
}

function getMigrationFiles(): string[] {
  if (!existsSync(getMigrationsDir())) {
    return [];
  }
  return readdirSync(getMigrationsDir())
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

export interface MigrateResult {
  applied: number;
  pending: string[];
  currentVersion: number;
  newVersion: number;
}

export function migrate(checkOnly = false): MigrateResult {
  ensureDbDir();
  const db = new Database(DB_FILE);

  try {
    let currentVersion = getDbVersion(db);

    // Handle legacy databases (user_version=0 but tables exist)
    if (currentVersion === 0 && dbExists()) {
      const detected = detectExistingVersion(db);
      if (detected > 0) {
        console.log(`Detected existing database at version ${detected} (setting user_version)`);
        setDbVersion(db, detected);
        currentVersion = detected;
      }
    }

    console.log(`Current database version: ${currentVersion}`);

    const migrations = getMigrationFiles();
    if (migrations.length === 0) {
      console.log(`No migrations found in ${getMigrationsDir()}`);
      return { applied: 0, pending: [], currentVersion, newVersion: currentVersion };
    }

    const pending: string[] = [];
    let applied = 0;
    let newVersion = currentVersion;

    for (const file of migrations) {
      const version = getMigrationVersion(file);
      if (version > currentVersion) {
        pending.push(file);
        if (!checkOnly) {
          console.log(`Applying migration ${version}: ${file}`);
          const sql = readFileSync(join(getMigrationsDir(), file), "utf-8");

          db.exec("BEGIN TRANSACTION");
          try {
            db.exec(sql);
            setDbVersion(db, version);
            db.exec("COMMIT");
            applied++;
            newVersion = version;
          } catch (err) {
            db.exec("ROLLBACK");
            throw err;
          }
        }
      }
    }

    if (pending.length === 0) {
      console.log("Database is up to date");
    } else if (checkOnly) {
      console.log(`${pending.length} migration(s) pending`);
      for (const p of pending) {
        console.log(`Pending: ${p}`);
      }
    } else {
      console.log(`Applied ${applied} migration(s)`);
    }

    console.log(`Database version: ${newVersion}`);

    return { applied, pending, currentVersion, newVersion };
  } finally {
    db.close();
  }
}

export function checkMigrations(): { pending: number; files: string[] } {
  const result = migrate(true);
  return { pending: result.pending.length, files: result.pending };
}
