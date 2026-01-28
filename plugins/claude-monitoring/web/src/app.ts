import type {
  CleanupPreviewResponse,
  CleanupResponse,
  ConnectionStatus,
  EventResponse,
  EventsApiResponse,
  FilterMode,
  SessionStatusResponse,
} from "./types";

// Filter mode state
let currentMode: FilterMode = "waiting";

function initModeFromUrl(): void {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  if (mode === "active" || mode === "all") {
    currentMode = mode;
  } else {
    currentMode = "waiting";
  }
  updateToggleUI(currentMode);
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

function updateToggleUI(mode: FilterMode): void {
  const waitingBtn = document.getElementById("mode-waiting");
  const activeBtn = document.getElementById("mode-active");
  const allBtn = document.getElementById("mode-all");
  if (!waitingBtn || !activeBtn || !allBtn) return;

  waitingBtn.classList.remove("active");
  activeBtn.classList.remove("active");
  allBtn.classList.remove("active");

  if (mode === "waiting") {
    waitingBtn.classList.add("active");
  } else if (mode === "active") {
    activeBtn.classList.add("active");
  } else {
    allBtn.classList.add("active");
  }
}

function setFilterMode(mode: FilterMode): void {
  if (currentMode === mode) return;
  currentMode = mode;
  updateUrlWithMode(mode);
  updateToggleUI(mode);
  connectSSE(); // Reconnect SSE with new mode
}

// IndexedDB for read status
const DB_NAME = "claude-monitoring";
const STORE_NAME = "read-events";
let db: IDBDatabase | null = null;

async function initDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = (event) => {
      const target = event.target as IDBOpenDBRequest;
      const database = target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function getReadStatus(eventId: string): Promise<boolean> {
  const database = db;
  if (!database) return false;
  return new Promise((resolve) => {
    const tx = database.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(eventId);
    request.onsuccess = () => resolve(!!request.result);
    request.onerror = () => resolve(false);
  });
}

async function setReadStatus(eventId: string, isRead: boolean): Promise<void> {
  const database = db;
  if (!database) return;
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    if (isRead) {
      store.put(true, eventId);
    } else {
      store.delete(eventId);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Toast notifications
function showToast(message: string, type: "success" | "error" = "success"): void {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast ${type}`;

  setTimeout(() => {
    toast.classList.add("hidden");
  }, 2000);
}

// Check session status (for process tracking)
async function checkSessionStatus(sessionId: string): Promise<SessionStatusResponse> {
  try {
    const response = await fetch(`/api/sessions/${sessionId}/status`);
    return response.ok
      ? await response.json()
      : { exists: false, process_pid: null, process_running: false };
  } catch {
    return { exists: false, process_pid: null, process_running: false };
  }
}

// Delete session
async function deleteSession(sessionId: string): Promise<void> {
  try {
    const response = await fetch(`/api/sessions/${sessionId}`, {
      method: "DELETE",
    });
    if (response.ok) {
      showToast("Session deleted");
    } else {
      showToast("Failed to delete session", "error");
    }
  } catch {
    showToast("Failed to delete session", "error");
  }
}

// Clipboard
async function copyToClipboard(text: string, label = "text"): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`Copied ${label} to clipboard!`);
  } catch {
    showToast(`Failed to copy ${label}`, "error");
  }
}

// Format time
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// Escape HTML to prevent XSS
function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Render events
async function renderEvents(events: EventResponse[]): Promise<void> {
  const tbody = document.getElementById("events-body") as HTMLTableSectionElement | null;
  const table = document.getElementById("events-table");
  const emptyState = document.getElementById("empty-state");

  if (!tbody || !table || !emptyState) return;

  if (events.length === 0) {
    table.classList.add("hidden");
    emptyState.classList.remove("hidden");
    return;
  }

  table.classList.remove("hidden");
  emptyState.classList.add("hidden");

  // Build rows with read status
  const rows = await Promise.all(
    events.map(async (event) => {
      const isRead = await getReadStatus(event.event_id);
      return { event, isRead };
    }),
  );

  tbody.innerHTML = rows
    .map(
      ({ event, isRead }) => `
    <tr class="${isRead ? "read" : ""}" data-event-id="${event.event_id}">
      <td class="col-project">
        <div class="project-info">
          <span class="project-name">${escapeHtml(event.project_name)}</span>${event.git_branch ? `<span class="git-branch">(${escapeHtml(event.git_branch)})</span>` : ""}
        </div>
        <div class="session-info">
          ${event.tmux_window_id ? `<span class="tmux-id">${escapeHtml(event.tmux_window_id)}</span>` : ""}
          <span class="session-id">${escapeHtml(event.session_id.substring(0, 8))}</span>
        </div>
      </td>
      <td class="col-status">
        <span class="status-badge ${event.event_type}">${event.event_type}</span>
      </td>
      <td class="col-time">
        <span class="time">${formatTime(event.created_at)}</span>
      </td>
      <td class="col-summary">
        <span class="summary" title="${escapeHtml(event.summary)}">${escapeHtml(event.summary)}</span>
      </td>
      <td class="col-copy">
        ${
          event.tmux_command
            ? `<button class="copy-btn ${isRead ? "copied" : ""}" data-command="${escapeHtml(event.tmux_command)}" title="${escapeHtml(event.tmux_command)}">
                ${
                  isRead
                    ? `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path fill-rule="evenodd" d="M10.854 7.146a.5.5 0 010 .708l-3 3a.5.5 0 01-.708 0l-1.5-1.5a.5.5 0 11.708-.708L7.5 9.793l2.646-2.647a.5.5 0 01.708 0z"/>
                      <path d="M4 1.5H3a2 2 0 00-2 2V13a2 2 0 002 2h10a2 2 0 002-2V3.5a2 2 0 00-2-2h-1v1h1a1 1 0 011 1V13a1 1 0 01-1 1H3a1 1 0 01-1-1V3.5a1 1 0 011-1h1v-1z"/>
                      <path d="M9.5 1a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-3a.5.5 0 01-.5-.5v-1a.5.5 0 01.5-.5h3zm-3-1A1.5 1.5 0 005 1.5v1A1.5 1.5 0 006.5 4h3A1.5 1.5 0 0011 2.5v-1A1.5 1.5 0 009.5 0h-3z"/>
                    </svg>`
                    : `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M4 1.5H3a2 2 0 00-2 2V13a2 2 0 002 2h10a2 2 0 002-2V3.5a2 2 0 00-2-2h-1v1h1a1 1 0 011 1V13a1 1 0 01-1 1H3a1 1 0 01-1-1V3.5a1 1 0 011-1h1v-1z"/>
                      <path d="M9.5 1a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-3a.5.5 0 01-.5-.5v-1a.5.5 0 01.5-.5h3zm-3-1A1.5 1.5 0 005 1.5v1A1.5 1.5 0 006.5 4h3A1.5 1.5 0 0011 2.5v-1A1.5 1.5 0 009.5 0h-3z"/>
                    </svg>`
                }
              </button>`
            : '<span class="no-tmux">-</span>'
        }
      </td>
      <td class="col-actions">
        <button class="end-session-btn" data-session-id="${escapeHtml(event.session_id)}" title="End session">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/>
            <path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
          </svg>
        </button>
      </td>
    </tr>
  `,
    )
    .join("");

  // Event listeners for copy buttons
  for (const btn of Array.from(tbody.querySelectorAll(".copy-btn"))) {
    btn.addEventListener("click", async (e: Event) => {
      const target = e.target as HTMLElement;
      const button = target.closest(".copy-btn") as HTMLButtonElement | null;
      if (!button) return;

      const command = button.dataset.command;
      if (!command) return;

      await copyToClipboard(command, "tmux command");

      // Mark as copied
      const row = button.closest("tr");
      if (!row) return;

      const eventId = row.dataset.eventId;
      if (!eventId) return;

      if (!button.classList.contains("copied")) {
        button.classList.add("copied");
        // Replace SVG with clipboard-check icon
        button.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path fill-rule="evenodd" d="M10.854 7.146a.5.5 0 010 .708l-3 3a.5.5 0 01-.708 0l-1.5-1.5a.5.5 0 11.708-.708L7.5 9.793l2.646-2.647a.5.5 0 01.708 0z"/>
          <path d="M4 1.5H3a2 2 0 00-2 2V13a2 2 0 002 2h10a2 2 0 002-2V3.5a2 2 0 00-2-2h-1v1h1a1 1 0 011 1V13a1 1 0 01-1 1H3a1 1 0 01-1-1V3.5a1 1 0 011-1h1v-1z"/>
          <path d="M9.5 1a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-3a.5.5 0 01-.5-.5v-1a.5.5 0 01.5-.5h3zm-3-1A1.5 1.5 0 005 1.5v1A1.5 1.5 0 006.5 4h3A1.5 1.5 0 0011 2.5v-1A1.5 1.5 0 009.5 0h-3z"/>
        </svg>`;

        await setReadStatus(eventId, true);
        row.classList.add("read");
      }
    });
  }

  // Event listeners for end session buttons
  for (const btn of Array.from(tbody.querySelectorAll(".end-session-btn"))) {
    btn.addEventListener("click", async (e: Event) => {
      const target = e.target as HTMLElement;
      const button = target.closest(".end-session-btn") as HTMLButtonElement | null;
      if (!button) return;

      const sessionId = button.dataset.sessionId;
      if (!sessionId) return;

      const row = button.closest("tr") as HTMLTableRowElement | null;
      if (!row) return;

      // Add fade-out animation
      row.style.transition = "opacity 0.3s";
      row.style.opacity = "0.5";

      // Check if the Claude Code process is still running
      const status = await checkSessionStatus(sessionId);
      if (status.process_running) {
        const confirmed = confirm(
          "Warning: Claude Code session is still running.\n\n" +
            "Are you sure you want to delete this session?\n" +
            "(The process will continue running, but all event history will be removed)",
        );
        if (!confirmed) {
          row.style.opacity = "1";
          return;
        }
      }

      await deleteSession(sessionId);
    });
  }
}

// Connection status
function setConnectionStatus(status: ConnectionStatus): void {
  const indicator = document.getElementById("connection-status");
  const text = document.getElementById("connection-text");

  if (!indicator || !text) return;

  indicator.className = `status-indicator ${status}`;
  switch (status) {
    case "connected":
      text.textContent = "Live";
      break;
    case "polling":
      text.textContent = "Polling";
      break;
    case "disconnected":
      text.textContent = "Disconnected";
      break;
  }
}

// SSE connection
let eventSource: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function connectSSE(): void {
  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource(`/api/events/stream?mode=${currentMode}`);

  eventSource.onopen = () => {
    setConnectionStatus("connected");
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  eventSource.onmessage = (event) => {
    try {
      const data: EventsApiResponse = JSON.parse(event.data);
      renderEvents(data.events);
    } catch (err) {
      console.error("Failed to parse event data:", err);
    }
  };

  eventSource.onerror = () => {
    setConnectionStatus("disconnected");
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }

    // Fallback to polling
    if (!pollTimer) {
      setConnectionStatus("polling");
      pollTimer = setInterval(pollEvents, 5000);
      pollEvents(); // Immediate poll
    }

    // Try to reconnect SSE after 30 seconds
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      if (pollTimer) {
        connectSSE();
      }
    }, 30000);
  };
}

async function pollEvents(): Promise<void> {
  try {
    const response = await fetch(`/api/events?mode=${currentMode}`);
    if (response.ok) {
      const data: EventsApiResponse = await response.json();
      renderEvents(data.events);
    }
  } catch (err) {
    console.error("Failed to poll events:", err);
  }
}

// Cleanup functionality
async function getCleanupPreview(): Promise<CleanupPreviewResponse> {
  try {
    const response = await fetch("/api/cleanup/preview");
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.error("Failed to get cleanup preview:", err);
  }
  return { count: 0, sessions: [] };
}

async function performCleanup(): Promise<CleanupResponse> {
  try {
    const response = await fetch("/api/cleanup", { method: "POST" });
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.error("Failed to perform cleanup:", err);
  }
  return { deleted_count: 0 };
}

function showCleanupModal(preview: CleanupPreviewResponse): void {
  const modal = document.getElementById("cleanup-modal");
  const countEl = document.getElementById("cleanup-count");
  const listEl = document.getElementById("cleanup-list");

  if (!modal || !countEl || !listEl) return;

  if (preview.count === 0) {
    showToast("No dead sessions to cleanup");
    return;
  }

  countEl.textContent = `${preview.count} session${preview.count !== 1 ? "s" : ""} will be deleted.`;
  listEl.innerHTML = preview.sessions
    .map(
      (s) =>
        `<li>${escapeHtml(s.project_name || "unknown")} <span class="session-id">(${escapeHtml(s.session_id.substring(0, 8))})</span></li>`,
    )
    .join("");

  modal.classList.remove("hidden");
}

function hideCleanupModal(): void {
  const modal = document.getElementById("cleanup-modal");
  if (modal) {
    modal.classList.add("hidden");
  }
}

// Initialize
async function init(): Promise<void> {
  await initDb();
  initModeFromUrl();

  // Set up filter toggle handlers
  const modeWaiting = document.getElementById("mode-waiting");
  const modeActive = document.getElementById("mode-active");
  const modeAll = document.getElementById("mode-all");

  if (modeWaiting) {
    modeWaiting.addEventListener("click", () => {
      setFilterMode("waiting");
    });
  }

  if (modeActive) {
    modeActive.addEventListener("click", () => {
      setFilterMode("active");
    });
  }

  if (modeAll) {
    modeAll.addEventListener("click", () => {
      setFilterMode("all");
    });
  }

  // Set up cleanup handlers
  const cleanupBtn = document.getElementById("cleanup-btn");
  const cleanupCancel = document.getElementById("cleanup-cancel");
  const cleanupConfirm = document.getElementById("cleanup-confirm");
  const cleanupModal = document.getElementById("cleanup-modal");

  if (cleanupBtn) {
    cleanupBtn.addEventListener("click", async () => {
      const preview = await getCleanupPreview();
      showCleanupModal(preview);
    });
  }

  if (cleanupCancel) {
    cleanupCancel.addEventListener("click", () => {
      hideCleanupModal();
    });
  }

  if (cleanupConfirm) {
    cleanupConfirm.addEventListener("click", async () => {
      hideCleanupModal();
      const result = await performCleanup();
      if (result.deleted_count > 0) {
        showToast(
          `Deleted ${result.deleted_count} session${result.deleted_count !== 1 ? "s" : ""}`,
        );
      } else {
        showToast("No sessions were deleted", "error");
      }
    });
  }

  // Close modal when clicking outside
  if (cleanupModal) {
    cleanupModal.addEventListener("click", (e) => {
      if (e.target === cleanupModal) {
        hideCleanupModal();
      }
    });
  }

  connectSSE();
}

init();
