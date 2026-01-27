// Filter mode state
let currentMode = "waiting"; // 'waiting' | 'active'

function initModeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  currentMode = params.get("mode") === "active" ? "active" : "waiting";
  updateToggleUI(currentMode);
}

function updateUrlWithMode(mode) {
  const url = new URL(window.location);
  if (mode === "waiting") {
    url.searchParams.delete("mode");
  } else {
    url.searchParams.set("mode", mode);
  }
  window.history.replaceState({}, "", url);
}

function updateToggleUI(mode) {
  const waitingBtn = document.getElementById("mode-waiting");
  const activeBtn = document.getElementById("mode-active");
  if (mode === "waiting") {
    waitingBtn.classList.add("active");
    activeBtn.classList.remove("active");
  } else {
    waitingBtn.classList.remove("active");
    activeBtn.classList.add("active");
  }
}

function setFilterMode(mode) {
  if (currentMode === mode) return;
  currentMode = mode;
  updateUrlWithMode(mode);
  updateToggleUI(mode);
  connectSSE(); // Reconnect SSE with new mode
}

// IndexedDB for read status
const DB_NAME = "claude-monitoring";
const STORE_NAME = "read-events";
let db = null;

async function initDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function getReadStatus(eventId) {
  if (!db) return false;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(eventId);
    request.onsuccess = () => resolve(!!request.result);
    request.onerror = () => resolve(false);
  });
}

async function setReadStatus(eventId, isRead) {
  if (!db) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
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
function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast ${type}`;

  setTimeout(() => {
    toast.classList.add("hidden");
  }, 2000);
}

// End session
async function endSession(sessionId) {
  try {
    const response = await fetch(`/api/sessions/${sessionId}/end`, {
      method: "POST",
    });
    if (response.ok) {
      showToast("Session ended");
    } else {
      showToast("Failed to end session", "error");
    }
  } catch (err) {
    showToast("Failed to end session", "error");
  }
}

// Clipboard
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied to clipboard!");
  } catch (err) {
    showToast("Failed to copy", "error");
  }
}

// Format time
function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// Render events
async function renderEvents(events) {
  const tbody = document.getElementById("events-body");
  const table = document.getElementById("events-table");
  const emptyState = document.getElementById("empty-state");

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
    })
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
                ${isRead
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
  `
    )
    .join("");

  // Event listeners for copy buttons
  tbody.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const button = e.target.closest(".copy-btn");
      const command = button.dataset.command;
      await copyToClipboard(command);

      // Mark as copied
      const row = button.closest("tr");
      const eventId = row.dataset.eventId;

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
  });

  // Event listeners for end session buttons
  tbody.querySelectorAll(".end-session-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const button = e.target.closest(".end-session-btn");
      const sessionId = button.dataset.sessionId;
      const row = button.closest("tr");

      // Add fade-out animation
      row.style.transition = "opacity 0.3s";
      row.style.opacity = "0.5";

      await endSession(sessionId);
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Connection status
function setConnectionStatus(status) {
  const indicator = document.getElementById("connection-status");
  const text = document.getElementById("connection-text");

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
let eventSource = null;
let reconnectTimer = null;
let pollTimer = null;

function connectSSE() {
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
      const data = JSON.parse(event.data);
      renderEvents(data.events);
    } catch (err) {
      console.error("Failed to parse event data:", err);
    }
  };

  eventSource.onerror = () => {
    setConnectionStatus("disconnected");
    eventSource.close();
    eventSource = null;

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

async function pollEvents() {
  try {
    const response = await fetch(`/api/events?mode=${currentMode}`);
    if (response.ok) {
      const data = await response.json();
      renderEvents(data.events);
    }
  } catch (err) {
    console.error("Failed to poll events:", err);
  }
}

// Initialize
async function init() {
  await initDb();
  initModeFromUrl();

  // Set up filter toggle handlers
  document.getElementById("mode-waiting").addEventListener("click", () => {
    setFilterMode("waiting");
  });
  document.getElementById("mode-active").addEventListener("click", () => {
    setFilterMode("active");
  });

  connectSSE();
}

init();
