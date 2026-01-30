// Event table component

import type { EventResponse } from "../types";
import { EventRow } from "./EventRow";

interface EventTableProps {
  events: EventResponse[];
  isRead: (eventId: string) => boolean;
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

export function EventTable({
  events,
  isRead,
  onCopy,
  onMarkRead,
  onDeleteSuccess,
  onDeleteFail,
  showConfirmDialog,
}: EventTableProps) {
  if (events.length === 0) {
    return (
      <div class="empty-state">
        <p>No active sessions found.</p>
        <p class="hint">Sessions will appear here when Claude Code is running.</p>
      </div>
    );
  }

  return (
    <table class="events-table">
      <thead>
        <tr>
          <th class="col-project">Project</th>
          <th class="col-status">Status</th>
          <th class="col-time">Time</th>
          <th class="col-summary">Summary</th>
          <th class="col-copy">Tmux</th>
          <th class="col-actions" />
        </tr>
      </thead>
      <tbody>
        {events.map((event) => (
          <EventRow
            key={event.event_id}
            event={event}
            isRead={isRead(event.event_id)}
            onCopy={onCopy}
            onMarkRead={onMarkRead}
            onDeleteSuccess={onDeleteSuccess}
            onDeleteFail={onDeleteFail}
            showConfirmDialog={showConfirmDialog}
          />
        ))}
      </tbody>
    </table>
  );
}
