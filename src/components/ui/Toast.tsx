"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

type ToastKind = "success" | "error";

interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

const ToastContext = createContext<{
  toast: (message: string, kind?: ToastKind) => void;
} | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const toast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = nextId.current++;
    setToasts((ts) => [...ts, { id, message, kind }]);
    setTimeout(() => {
      setToasts((ts) => ts.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="toast-enter pointer-events-auto flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm shadow-lg"
          >
            <span
              className={`h-8 w-[3px] shrink-0 rounded-full ${
                t.kind === "error" ? "bg-high" : "bg-low"
              }`}
            />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
