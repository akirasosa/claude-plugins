// Status badge component

import { parseEventType } from "../utils";

interface StatusBadgeProps {
  eventType: string;
}

export function StatusBadge({ eventType }: StatusBadgeProps) {
  const { baseType, subType, cssClass } = parseEventType(eventType);

  if (subType) {
    return (
      <span class="status-badge-wrapper">
        <span class={`status-badge ${cssClass}`}>{baseType}</span>
        <span class="status-badge-subtype">{subType}</span>
      </span>
    );
  }

  return <span class={`status-badge ${cssClass}`}>{baseType}</span>;
}
