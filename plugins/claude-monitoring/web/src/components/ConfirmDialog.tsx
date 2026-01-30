// Confirmation dialog component

import { useCallback, useEffect, useRef } from "preact/hooks";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

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
    confirmBtnRef.current?.focus();
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
      aria-labelledby="confirm-dialog-title"
      onClick={handleBackdropClick}
      onKeyDown={handleKeydown}
    >
      <div class="modal-content confirm-dialog-content">
        <h2 id="confirm-dialog-title">{title}</h2>
        <p>{message}</p>
        <div class="modal-actions">
          <button type="button" class="modal-btn cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" ref={confirmBtnRef} class="modal-btn confirm" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
