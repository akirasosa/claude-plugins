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
      <td class="col-read">
        <div class="checkbox-wrapper">
          <input type="checkbox" ${isRead ? "checked" : ""}
            data-event-id="${event.event_id}"
            title="Mark as read">
        </div>
      </td>
      <td class="col-project">
        <span class="project-name">${escapeHtml(event.project_name)}</span>${event.git_branch ? `<span class="git-branch">(${escapeHtml(event.git_branch)})</span>` : ""}
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
      <td class="col-jump">
        ${
          event.tmux_command
            ? `<button class="jump-btn" data-command="${escapeHtml(event.tmux_command)}" title="${escapeHtml(event.tmux_command)}">${escapeHtml(event.tmux_command)}</button>`
            : '<span class="no-tmux">-</span>'
        }
      </td>
    </tr>
  `
    )
    .join("");

  // Event listeners for checkboxes
  tbody.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener("change", async (e) => {
      const eventId = e.target.dataset.eventId;
      const isRead = e.target.checked;
      await setReadStatus(eventId, isRead);
      const row = e.target.closest("tr");
      if (isRead) {
        row.classList.add("read");
      } else {
        row.classList.remove("read");
      }
    });
  });

  // Event listeners for jump buttons
  tbody.querySelectorAll(".jump-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const command = e.target.dataset.command;
      copyToClipboard(command);
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

  eventSource = new EventSource("/api/events/stream");

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
    const response = await fetch("/api/events");
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
  connectSSE();
}

init();
