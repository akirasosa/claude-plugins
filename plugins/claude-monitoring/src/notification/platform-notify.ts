/**
 * Show a desktop notification using platform-specific tools.
 * macOS: osascript, Linux: notify-send
 */
export async function showNotification(
  title: string,
  message: string
): Promise<void> {
  try {
    if (process.platform === "darwin") {
      // macOS: use osascript
      const escapedMessage = message.replace(/"/g, '\\"');
      const escapedTitle = title.replace(/"/g, '\\"');
      const proc = Bun.spawn([
        "osascript",
        "-e",
        `display notification "${escapedMessage}" with title "${escapedTitle}"`,
      ], {
        stdout: "ignore",
        stderr: "ignore",
      });
      await proc.exited;
    } else {
      // Linux: use notify-send
      const proc = Bun.spawn(["notify-send", title, message], {
        stdout: "ignore",
        stderr: "ignore",
      });
      await proc.exited;
    }
  } catch {
    // Silently ignore notification errors
  }
}
