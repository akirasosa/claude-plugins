// Main application component

import { useCallback, useState } from "preact/hooks";
import { getCleanupPreview, performCleanup } from "../api";
import { useEvents, useFilterMode, useReadStatus, useToast } from "../hooks";
import type { CleanupPreviewResponse } from "../types";
import { CleanupModal } from "./CleanupModal";
import { ConfirmDialog } from "./ConfirmDialog";
import { ConnectionStatus } from "./ConnectionStatus";
import { EventTable } from "./EventTable";
import { FilterToggle } from "./FilterToggle";
import { TrashIcon } from "./Icons";
import { Toast } from "./Toast";

interface DialogState {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  resolve: (value: boolean) => void;
}

export function App() {
  const { mode, setMode } = useFilterMode();
  const { events, status } = useEvents(mode);
  const { isRead, markAsRead } = useReadStatus();
  const { toast, showToast } = useToast();

  const [cleanupPreview, setCleanupPreview] = useState<CleanupPreviewResponse | null>(null);
  const [dialogState, setDialogState] = useState<DialogState | null>(null);

  const handleCopy = useCallback(
    async (command: string) => {
      try {
        await navigator.clipboard.writeText(command);
        showToast("Copied tmux command to clipboard!");
      } catch {
        showToast("Failed to copy tmux command", "error");
      }
    },
    [showToast],
  );

  const handleDeleteSuccess = useCallback(() => {
    showToast("Session deleted");
  }, [showToast]);

  const handleDeleteFail = useCallback(() => {
    showToast("Failed to delete session", "error");
  }, [showToast]);

  const showConfirmDialog = useCallback(
    (options: {
      title: string;
      message: string;
      confirmLabel: string;
      cancelLabel: string;
    }): Promise<boolean> => {
      return new Promise((resolve) => {
        setDialogState({ ...options, resolve });
      });
    },
    [],
  );

  const handleDialogConfirm = useCallback(() => {
    dialogState?.resolve(true);
    setDialogState(null);
  }, [dialogState]);

  const handleDialogCancel = useCallback(() => {
    dialogState?.resolve(false);
    setDialogState(null);
  }, [dialogState]);

  const handleCleanupClick = useCallback(async () => {
    const preview = await getCleanupPreview();
    if (preview.count === 0) {
      showToast("No dead sessions to cleanup");
      return;
    }
    setCleanupPreview(preview);
  }, [showToast]);

  const handleCleanupConfirm = useCallback(async () => {
    setCleanupPreview(null);
    const result = await performCleanup();
    if (result.deleted_count > 0) {
      showToast(`Deleted ${result.deleted_count} session${result.deleted_count !== 1 ? "s" : ""}`);
    } else {
      showToast("No sessions were deleted", "error");
    }
  }, [showToast]);

  const handleCleanupCancel = useCallback(() => {
    setCleanupPreview(null);
  }, []);

  return (
    <div class="max-w-[1400px] mx-auto p-6 max-md:p-4">
      <header class="flex justify-between items-center mb-6 pb-4 border-b border-border-default max-md:flex-wrap max-md:gap-3">
        <h1 class="text-[1.75rem] font-semibold text-text-primary max-md:text-2xl">
          Claude Monitoring
        </h1>
        <FilterToggle mode={mode} onModeChange={setMode} />
        <button
          type="button"
          class="cleanup-btn"
          onClick={handleCleanupClick}
          title="Delete sessions where process is not running"
        >
          <TrashIcon />
          Cleanup
        </button>
        <ConnectionStatus status={status} />
      </header>

      <main>
        <EventTable
          events={events}
          isRead={isRead}
          onCopy={handleCopy}
          onMarkRead={markAsRead}
          onDeleteSuccess={handleDeleteSuccess}
          onDeleteFail={handleDeleteFail}
          showConfirmDialog={showConfirmDialog}
        />
      </main>

      {toast && <Toast message={toast.message} type={toast.type} />}

      {cleanupPreview && (
        <CleanupModal
          preview={cleanupPreview}
          onConfirm={handleCleanupConfirm}
          onCancel={handleCleanupCancel}
        />
      )}

      {dialogState && (
        <ConfirmDialog
          title={dialogState.title}
          message={dialogState.message}
          confirmLabel={dialogState.confirmLabel}
          cancelLabel={dialogState.cancelLabel}
          onConfirm={handleDialogConfirm}
          onCancel={handleDialogCancel}
        />
      )}
    </div>
  );
}
