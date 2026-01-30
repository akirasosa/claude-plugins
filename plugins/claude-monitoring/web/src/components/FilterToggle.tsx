// Filter mode toggle component

import type { FilterMode } from "../types";

interface FilterToggleProps {
  mode: FilterMode;
  onModeChange: (mode: FilterMode) => void;
}

export function FilterToggle({ mode, onModeChange }: FilterToggleProps) {
  return (
    <div class="flex gap-1 bg-bg-secondary p-1 rounded-lg border border-border-default max-md:order-3 max-md:w-full max-md:justify-center">
      <button
        type="button"
        class={`filter-btn ${mode === "waiting" ? "active" : ""}`}
        onClick={() => onModeChange("waiting")}
        title="Only Stop/Notification events"
      >
        Waiting
      </button>
      <button
        type="button"
        class={`filter-btn ${mode === "active" ? "active" : ""}`}
        onClick={() => onModeChange("active")}
        title="All active sessions"
      >
        Active
      </button>
      <button
        type="button"
        class={`filter-btn ${mode === "all" ? "active" : ""}`}
        onClick={() => onModeChange("all")}
        title="All sessions including ended"
      >
        All
      </button>
    </div>
  );
}
