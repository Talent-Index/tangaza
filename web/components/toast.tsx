"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";

type ToastTone = "good" | "bad" | "neutral";

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
};

type ToastApi = {
  toast: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const TONE_STYLES: Record<ToastTone, string> = {
  good: "border-jade-500/40 bg-ink-900 text-jade-400",
  bad: "border-crimson-500/40 bg-ink-900 text-crimson-300",
  neutral: "border-ink-600 bg-ink-900 text-mist-200",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, tone: ToastTone = "neutral") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setItems((prev) => [...prev.slice(-4), { id, message, tone }]);
  }, []);

  const api: ToastApi = {
    toast,
    success: (message) => toast(message, "good"),
    error: (message) => toast(message, "bad"),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((item) => (
          <ToastBubble key={item.id} item={item} onDone={() => dismiss(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastBubble({
  item,
  onDone,
}: {
  item: ToastItem;
  onDone: () => void;
}) {
  const labelId = useId();

  useEffect(() => {
    const t = window.setTimeout(onDone, 3800);
    return () => window.clearTimeout(t);
  }, [onDone]);

  return (
    <div
      role="status"
      id={labelId}
      className={`pointer-events-auto animate-toast-in max-w-sm rounded-xl border px-4 py-3 text-sm shadow-[0_12px_40px_-16px_rgb(0_0_0/0.65)] ${TONE_STYLES[item.tone]}`}
    >
      {item.message}
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
