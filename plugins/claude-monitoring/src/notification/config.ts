import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SETTINGS_FILE = join(homedir(), ".claude", "claude-monitoring.local.md");

/**
 * Get GCP project ID for Gemini API
 * Priority: 1. Environment variable, 2. Settings file, 3. gcloud default
 */
export function getGcpProject(): string | null {
  // 1. Environment variable
  if (process.env.GEMINI_GCP_PROJECT) {
    return process.env.GEMINI_GCP_PROJECT;
  }

  // 2. Settings file
  if (existsSync(SETTINGS_FILE)) {
    try {
      const content = readFileSync(SETTINGS_FILE, "utf-8");
      const match = content.match(/^gcp_project:\s*(.+)$/m);
      if (match) {
        return match[1].trim();
      }
    } catch {
      // Ignore file read errors
    }
  }

  // 3. gcloud default project
  try {
    return (
      execSync("gcloud config get-value project", {
        encoding: "utf-8",
        timeout: 3000,
        stdio: ["pipe", "pipe", "pipe"],
      }).trim() || null
    );
  } catch {
    return null;
  }
}

/**
 * Get GCP location for Gemini API
 * Priority: 1. Environment variable, 2. Settings file, 3. Default (asia-northeast1)
 */
export function getGcpLocation(): string {
  // 1. Environment variable
  if (process.env.GEMINI_GCP_LOCATION) {
    return process.env.GEMINI_GCP_LOCATION;
  }

  // 2. Settings file
  if (existsSync(SETTINGS_FILE)) {
    try {
      const content = readFileSync(SETTINGS_FILE, "utf-8");
      const match = content.match(/^gcp_location:\s*(.+)$/m);
      if (match) {
        return match[1].trim();
      }
    } catch {
      // Ignore file read errors
    }
  }

  // 3. Default
  return "asia-northeast1";
}
