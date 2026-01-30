// Toast notification component

import type { ToastType } from "../hooks/useToast";

interface ToastProps {
  message: string;
  type: ToastType;
}

export function Toast({ message, type }: ToastProps) {
  return <div class={`toast ${type}`}>{message}</div>;
}
