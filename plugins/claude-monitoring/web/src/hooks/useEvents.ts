// SSE connection and events state hook

import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { fetchEvents } from "../api";
import type { ConnectionStatus, EventResponse, EventsApiResponse, FilterMode } from "../types";

// Constants
const POLL_INTERVAL_MS = 5000;
const RECONNECT_TIMEOUT_MS = 30000;

interface UseEventsResult {
  events: EventResponse[];
  status: ConnectionStatus;
  reconnect: () => void;
}

export function useEvents(mode: FilterMode): UseEventsResult {
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const pollEvents = useCallback(async () => {
    const data = await fetchEvents(mode);
    if (data) {
      setEvents(data.events);
    }
  }, [mode]);

  const connect = useCallback(() => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    clearTimers();

    const eventSource = new EventSource(`/api/events/stream?mode=${mode}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setStatus("connected");
      clearTimers();
    };

    eventSource.onmessage = (event) => {
      try {
        const data: EventsApiResponse = JSON.parse(event.data);
        setEvents(data.events);
      } catch (err) {
        console.error("Failed to parse event data:", err);
      }
    };

    eventSource.onerror = () => {
      setStatus("disconnected");
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      // Fallback to polling
      if (!pollTimerRef.current) {
        setStatus("polling");
        pollTimerRef.current = setInterval(pollEvents, POLL_INTERVAL_MS);
        pollEvents(); // Immediate poll
      }

      // Try to reconnect SSE after timeout
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        if (pollTimerRef.current) {
          connect();
        }
      }, RECONNECT_TIMEOUT_MS);
    };
  }, [mode, pollEvents, clearTimers]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      clearTimers();
    };
  }, [connect, clearTimers]);

  return { events, status, reconnect: connect };
}
