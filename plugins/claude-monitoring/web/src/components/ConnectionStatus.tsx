// Connection status indicator component

import type { ConnectionStatus as ConnectionStatusType } from "../types";

interface ConnectionStatusProps {
  status: ConnectionStatusType;
}

function getStatusText(status: ConnectionStatusType): string {
  switch (status) {
    case "connected":
      return "Live";
    case "polling":
      return "Polling";
    case "disconnected":
      return "Disconnected";
  }
}

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  return (
    <div class="flex items-center gap-2.5 text-[0.9375rem] text-text-muted">
      <span class={`status-indicator ${status}`} />
      <span>{getStatusText(status)}</span>
    </div>
  );
}
