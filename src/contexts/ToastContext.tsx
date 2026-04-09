import { useState, useCallback, ReactNode } from "react";
import { ToastContainer, ToastData, ToastType } from "../components/ui/Toast";
import { ToastContext } from "./toastContextInstance";

interface ToastProviderProps {
  children: ReactNode;
}

/**
 * Provider pour le système de notifications toast
 */
export const ToastProvider = ({ children }: ToastProviderProps) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback(
    (message: string) => addToast(message, "success"),
    [addToast]
  );
  const error = useCallback(
    (message: string) => addToast(message, "error"),
    [addToast]
  );
  const info = useCallback(
    (message: string) => addToast(message, "info"),
    [addToast]
  );
  const warning = useCallback(
    (message: string) => addToast(message, "warning"),
    [addToast]
  );

  return (
    <ToastContext.Provider value={{ success, error, info, warning }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};
