// IndexedDB read status hook

import { useCallback, useEffect, useRef, useState } from "preact/hooks";

const DB_NAME = "claude-monitoring";
const STORE_NAME = "read-events";

interface UseReadStatusResult {
  isReady: boolean;
  isRead: (eventId: string) => boolean;
  markAsRead: (eventId: string) => Promise<void>;
}

export function useReadStatus(): UseReadStatusResult {
  const [isReady, setIsReady] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const dbRef = useRef<IDBDatabase | null>(null);

  useEffect(() => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => {
      console.error("Failed to open IndexedDB:", request.error);
      setIsReady(true); // Still ready, just without persistence
    };

    request.onsuccess = () => {
      dbRef.current = request.result;

      // Load all read IDs
      const tx = request.result.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const getAllRequest = store.getAllKeys();

      getAllRequest.onsuccess = () => {
        setReadIds(new Set(getAllRequest.result as string[]));
        setIsReady(true);
      };

      getAllRequest.onerror = () => {
        setIsReady(true);
      };
    };

    request.onupgradeneeded = (event) => {
      const target = event.target as IDBOpenDBRequest;
      const database = target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    return () => {
      if (dbRef.current) {
        dbRef.current.close();
        dbRef.current = null;
      }
    };
  }, []);

  const isRead = useCallback(
    (eventId: string): boolean => {
      return readIds.has(eventId);
    },
    [readIds],
  );

  const markAsRead = useCallback(async (eventId: string): Promise<void> => {
    const database = dbRef.current;
    if (!database) return;

    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(true, eventId);

      tx.oncomplete = () => {
        setReadIds((prev) => new Set([...prev, eventId]));
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }, []);

  return { isReady, isRead, markAsRead };
}
