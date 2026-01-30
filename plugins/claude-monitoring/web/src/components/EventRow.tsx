// Event row component

import { useState } from "preact/hooks";
import { checkSessionStatus, deleteSessionApi } from "../api";
import type { EventResponse } from "../types";
import { formatTime, isAiSummary } from "../utils";
import { ClipboardCheckIcon, ClipboardIcon, TrashIcon } from "./Icons";
import { StatusBadge } from "./StatusBadge";

interface EventRowProps {
  event: EventResponse;
  isRead: boolean;
  onCopy: (command: string) => Promise<void>;
  onMarkRead: (eventId: string) => Promise<void>;
  onDeleteSuccess: () => void;
  onDeleteFail: () => void;
  showConfirmDialog: (options: {
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
  }) => Promise<boolean>;
}

export function EventRow({
  event,
  isRead,
  onCopy,
  onMarkRead,
  onDeleteSuccess,
  onDeleteFail,
  showConfirmDialog,
}: EventRowProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCopy = async () => {
    if (!event.tmux_command) return;
    await onCopy(event.tmux_command);
    await onMarkRead(event.event_id);
  };

  const handleDelete = async () => {
    setIsDeleting(true);

    // Check if the Claude Code process is still running
    const status = await checkSessionStatus(event.session_id);
    if (status.process_running) {
      const confirmed = await showConfirmDialog({
        title: "Delete Running Session",
        message:
          "Warning: Claude Code session is still running. " +
          "The process will continue running, but all event history will be removed.",
        confirmLabel: "Delete Session",
        cancelLabel: "Cancel",
      });
      if (!confirmed) {
        setIsDeleting(false);
        return;
      }
    }

    const success = await deleteSessionApi(event.session_id);
    if (success) {
      onDeleteSuccess();
    } else {
      onDeleteFail();
      setIsDeleting(false);
    }
  };

  return (
    <tr
      class={`${isRead ? "read" : ""} ${isDeleting ? "opacity-50" : ""}`}
      data-event-id={event.event_id}
    >
      <td class="col-project">
        <div class="project-info">
          <span class="project-name">{event.project_name}</span>
          {event.git_branch && <span class="git-branch">({event.git_branch})</span>}
        </div>
        <div class="session-info">
          {event.tmux_window_id && <span class="tmux-id">{event.tmux_window_id}</span>}
          <span class="session-id">{event.session_id.substring(0, 8)}</span>
        </div>
      </td>
      <td class="col-status">
        <StatusBadge eventType={event.event_type} />
      </td>
      <td class="col-time">
        <span class="time">{formatTime(event.created_at)}</span>
      </td>
      <td class="col-summary">
        <div class="summary-wrapper">
          <span class="summary" title={event.summary}>
            {event.summary}
          </span>
          {isAiSummary(event.summary) && (
            <span class="ai-indicator" title="AI-generated summary">
              ✨
            </span>
          )}
        </div>
      </td>
      <td class="col-copy">
        {event.tmux_command ? (
          <button
            type="button"
            class={`copy-btn ${isRead ? "copied" : ""}`}
            onClick={handleCopy}
            title={event.tmux_command}
          >
            {isRead ? <ClipboardCheckIcon /> : <ClipboardIcon />}
          </button>
        ) : (
          <span class="no-tmux">-</span>
        )}
      </td>
      <td class="col-actions">
        <button
          type="button"
          class="end-session-btn"
          onClick={handleDelete}
          title="End session"
          disabled={isDeleting}
        >
          <TrashIcon />
        </button>
      </td>
    </tr>
  );
}
