// DOM rendering functions

import { checkSessionStatus, deleteSessionApi } from "./api";
import { ICON_CLIPBOARD, ICON_CLIPBOARD_CHECK, ICON_TRASH } from "./icons";
import { getReadStatus, setReadStatus } from "./storage";
import type { EventResponse } from "./types";
import { copyToClipboard, hideElement, showConfirmDialog, showElement, showToast } from "./ui";
import { escapeHtml, formatTime, isAiSummary, parseEventType } from "./utils";

/**
 * Build status badge HTML
 */
function buildStatusBadge(eventType: string): string {
  const { baseType, subType, cssClass } = parseEventType(eventType);
  if (subType) {
    return `<span class="status-badge-wrapper">
      <span class="status-badge ${cssClass}">${escapeHtml(baseType)}</span>
      <span class="status-badge-subtype">${escapeHtml(subType)}</span>
    </span>`;
  }
  return `<span class="status-badge ${cssClass}">${escapeHtml(baseType)}</span>`;
}

/**
 * Build HTML for a single event row
 */
function buildEventRow(event: EventResponse, isRead: boolean): string {
  const copyIcon = isRead ? ICON_CLIPBOARD_CHECK : ICON_CLIPBOARD;
  const copyButton = event.tmux_command
    ? `<button class="copy-btn ${isRead ? "copied" : ""}" data-command="${escapeHtml(event.tmux_command)}" title="${escapeHtml(event.tmux_command)}">${copyIcon}</button>`
    : '<span class="no-tmux">-</span>';

  return `
    <tr class="${isRead ? "read" : ""}" data-event-id="${event.event_id}">
      <td class="col-project">
        <div class="project-info">
          <span class="project-name">${escapeHtml(event.project_name)}</span>${event.git_branch ? `<span class="git-branch">(${escapeHtml(event.git_branch)})</span>` : ""}
        </div>
        <div class="session-info">
          ${event.tmux_window_id ? `<span class="tmux-id">${escapeHtml(event.tmux_window_id)}</span>` : ""}
          <span class="session-id">${escapeHtml(event.session_id.substring(0, 8))}</span>
        </div>
      </td>
      <td class="col-status">${buildStatusBadge(event.event_type)}</td>
      <td class="col-time">
        <span class="time">${formatTime(event.created_at)}</span>
      </td>
      <td class="col-summary">
        <div class="summary-wrapper">
          <span class="summary" title="${escapeHtml(event.summary)}">${escapeHtml(event.summary)}</span>
          ${isAiSummary(event.summary) ? '<span class="ai-indicator" title="AI-generated summary">✨</span>' : ""}
        </div>
      </td>
      <td class="col-copy">${copyButton}</td>
      <td class="col-actions">
        <button class="end-session-btn" data-session-id="${escapeHtml(event.session_id)}" title="End session">${ICON_TRASH}</button>
      </td>
    </tr>
  `;
}

/**
 * Attach event listeners to table body
 */
function attachEventListeners(tbody: HTMLTableSectionElement): void {
  // Event listeners for copy buttons
  for (const btn of Array.from(tbody.querySelectorAll(".copy-btn"))) {
    btn.addEventListener("click", async (e: Event) => {
      const target = e.target as HTMLElement;
      const button = target.closest(".copy-btn") as HTMLButtonElement | null;
      if (!button) return;

      const command = button.dataset.command;
      if (!command) return;

      await copyToClipboard(command, "tmux command");

      // Mark as copied
      const row = button.closest("tr");
      if (!row) return;

      const eventId = row.dataset.eventId;
      if (!eventId) return;

      if (!button.classList.contains("copied")) {
        button.classList.add("copied");
        button.innerHTML = ICON_CLIPBOARD_CHECK;

        await setReadStatus(eventId, true);
        row.classList.add("read");
      }
    });
  }

  // Event listeners for end session buttons
  for (const btn of Array.from(tbody.querySelectorAll(".end-session-btn"))) {
    btn.addEventListener("click", async (e: Event) => {
      const target = e.target as HTMLElement;
      const button = target.closest(".end-session-btn") as HTMLButtonElement | null;
      if (!button) return;

      const sessionId = button.dataset.sessionId;
      if (!sessionId) return;

      const row = button.closest("tr") as HTMLTableRowElement | null;
      if (!row) return;

      // Add fade-out animation
      row.style.transition = "opacity 0.3s";
      row.style.opacity = "0.5";

      // Check if the Claude Code process is still running
      const status = await checkSessionStatus(sessionId);
      if (status.process_running) {
        const confirmed = await showConfirmDialog({
          title: "Delete Running Session",
          message:
            "Warning: Claude Code session is still running. " +
            "The process will continue running, but all event history will be removed.",
          confirmLabel: "Delete Session",
          cancelLabel: "Cancel",
          destructive: true,
        });
        if (!confirmed) {
          row.style.opacity = "1";
          return;
        }
      }

      const success = await deleteSessionApi(sessionId);
      if (success) {
        showToast("Session deleted");
      } else {
        showToast("Failed to delete session", "error");
        row.style.opacity = "1";
      }
    });
  }
}

/**
 * Render events to the table
 */
export async function renderEvents(events: EventResponse[]): Promise<void> {
  const tbody = document.getElementById("events-body") as HTMLTableSectionElement | null;
  const table = document.getElementById("events-table");
  const emptyState = document.getElementById("empty-state");

  if (!tbody || !table || !emptyState) return;

  if (events.length === 0) {
    hideElement(table);
    showElement(emptyState);
    return;
  }

  showElement(table);
  hideElement(emptyState);

  // Build rows with read status
  const rows = await Promise.all(
    events.map(async (event) => {
      const isRead = await getReadStatus(event.event_id);
      return { event, isRead };
    }),
  );

  tbody.innerHTML = rows.map(({ event, isRead }) => buildEventRow(event, isRead)).join("");

  attachEventListeners(tbody);
}
