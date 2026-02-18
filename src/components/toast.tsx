"use client";

import { useState, useCallback, createContext, useContext } from "react";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let toastCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = `toast-${++toastCounter}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm max-w-sm pointer-events-auto animate-[fadeIn_0.2s_ease-out]",
              t.type === "success" && "bg-green-950/90 border-green-800 text-green-200",
              t.type === "error" && "bg-red-950/90 border-red-800 text-red-200",
              t.type === "info" && "bg-zinc-800/90 border-zinc-700 text-zinc-200"
            )}
          >
            {t.type === "success" && <CheckCircle size={18} className="shrink-0" />}
            {t.type === "error" && <AlertCircle size={18} className="shrink-0" />}
            {t.type === "info" && <Info size={18} className="shrink-0" />}
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="text-current opacity-50 hover:opacity-100 shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
