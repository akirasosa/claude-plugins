// Cleanup modal component

import { useCallback, useEffect } from "preact/hooks";
import type { CleanupPreviewResponse } from "../types";

interface CleanupModalProps {
  preview: CleanupPreviewResponse;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CleanupModal({ preview, onConfirm, onCancel }: CleanupModalProps) {
  const handleBackdropClick = useCallback(
    (e: MouseEvent) => {
      if ((e.target as HTMLElement).classList.contains("modal")) {
        onCancel();
      }
    },
    [onCancel],
  );

  const handleKeydown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    },
    [onCancel],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [handleKeydown]);

  return (
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cleanup-modal-title"
      onClick={handleBackdropClick}
      onKeyDown={handleKeydown}
    >
      <div class="modal-content">
        <h2 id="cleanup-modal-title">Cleanup Dead Sessions</h2>
        <p>
          {preview.count} session{preview.count !== 1 ? "s" : ""} will be deleted.
        </p>
        <ul class="cleanup-list">
          {preview.sessions.map((s) => (
            <li key={s.session_id}>
              {s.project_name || "unknown"}{" "}
              <span class="session-id">({s.session_id.substring(0, 8)})</span>
            </li>
          ))}
        </ul>
        <div class="modal-actions">
          <button type="button" class="modal-btn cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" class="modal-btn confirm" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
