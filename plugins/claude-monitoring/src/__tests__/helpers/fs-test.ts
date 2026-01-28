/**
 * File system test utilities for isolated test environments
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Track created temp directories for cleanup
 */
const createdDirs: string[] = [];

/**
 * Generate a unique temp directory path
 */
function generateTempPath(prefix = "test"): string {
  const id = Math.random().toString(36).slice(2, 10);
  const timestamp = Date.now();
  return join(tmpdir(), `claude-monitoring-${prefix}-${timestamp}-${id}`);
}

/**
 * Create an isolated temp directory for testing
 * Returns the path to the created directory
 */
export function createTempDir(prefix = "test"): string {
  const dir = generateTempPath(prefix);
  mkdirSync(dir, { recursive: true });
  createdDirs.push(dir);
  return dir;
}

/**
 * Create a file in the specified directory with the given content
 */
export function createFile(dir: string, filename: string, content: string): string {
  const filePath = join(dir, filename);
  const parentDir = join(filePath, "..");

  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }

  writeFileSync(filePath, content, "utf-8");
  return filePath;
}

/**
 * Create a transcript file with JSONL content
 */
export function createTranscriptFile(dir: string, lines: string[]): string {
  return createFile(dir, "transcript.jsonl", lines.join("\n"));
}

/**
 * Clean up a specific directory
 */
export function cleanupDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
  const index = createdDirs.indexOf(dir);
  if (index > -1) {
    createdDirs.splice(index, 1);
  }
}

/**
 * Clean up all temp directories created during tests
 * Call this in afterAll/afterEach hooks
 */
export function cleanupAll(): void {
  for (const dir of [...createdDirs]) {
    cleanupDir(dir);
  }
}

/**
 * Context manager for temp directory that auto-cleans
 */
export function withTempDir<T>(prefix: string, fn: (dir: string) => T): T {
  const dir = createTempDir(prefix);
  try {
    return fn(dir);
  } finally {
    cleanupDir(dir);
  }
}

/**
 * Async context manager for temp directory
 */
export async function withTempDirAsync<T>(prefix: string, fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = createTempDir(prefix);
  try {
    return await fn(dir);
  } finally {
    cleanupDir(dir);
  }
}
