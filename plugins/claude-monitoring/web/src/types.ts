// Client-side type definitions for the Web UI
// Shared types are imported from shared/types

// Re-export shared types for convenience
export type {
  CleanupCandidate,
  CleanupPreviewResponse,
  CleanupResponse,
  EventResponse,
  EventsApiResponse,
  FilterMode,
  SessionStatusResponse,
} from "../../shared/types";

// Client-only types

export type ConnectionStatus = "connected" | "polling" | "disconnected";

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}
