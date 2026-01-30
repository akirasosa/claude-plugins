// Toast notification hook

import { useCallback, useRef, useState } from "preact/hooks";

const TOAST_DURATION_MS = 2000;

export type ToastType = "success" | "error";

interface Toast {
  message: string;
  type: ToastType;
}

interface UseToastResult {
  toast: Toast | null;
  showToast: (message: string, type?: ToastType) => void;
}

export function useToast(): UseToastResult {
  const [toast, setToast] = useState<Toast | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    setToast({ message, type });

    timerRef.current = setTimeout(() => {
      setToast(null);
    }, TOAST_DURATION_MS);
  }, []);

  return { toast, showToast };
}
