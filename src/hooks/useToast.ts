import { useContext } from "react";
import { ToastContext } from "../contexts/toastContextInstance";

/**
 * Hook pour utiliser le système de toast.
 * @throws {Error} Si utilisé en dehors du ToastProvider
 */
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast doit être utilisé dans un ToastProvider");
  }
  return context;
};
