import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, X } from "lucide-react";

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    window.clearTimeout(window.__ledgerToast);
    window.__ledgerToast = window.setTimeout(() => setToast(null), 3200);
  }, []);
  return <ToastContext.Provider value={showToast}>
    {children}
    {toast && <div className={`toast ${toast.type}`} role="status"><CheckCircle2 size={20} /><span>{toast.message}</span><button onClick={() => setToast(null)} aria-label="إغلاق"><X size={17} /></button></div>}
  </ToastContext.Provider>;
}

export const useToast = () => useContext(ToastContext);
