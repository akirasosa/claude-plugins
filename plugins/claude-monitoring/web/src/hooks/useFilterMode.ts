// Filter mode state hook

import { useCallback, useState } from "preact/hooks";
import type { FilterMode } from "../types";

function getModeFromUrl(): FilterMode {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  if (mode === "active" || mode === "all") {
    return mode;
  }
  return "waiting";
}

function updateUrlWithMode(mode: FilterMode): void {
  const url = new URL(window.location.href);
  if (mode === "waiting") {
    url.searchParams.delete("mode");
  } else {
    url.searchParams.set("mode", mode);
  }
  window.history.replaceState({}, "", url);
}

interface UseFilterModeResult {
  mode: FilterMode;
  setMode: (mode: FilterMode) => void;
}

export function useFilterMode(): UseFilterModeResult {
  const [mode, setModeState] = useState<FilterMode>(getModeFromUrl);

  const setMode = useCallback((newMode: FilterMode) => {
    setModeState(newMode);
    updateUrlWithMode(newMode);
  }, []);

  return { mode, setMode };
}
