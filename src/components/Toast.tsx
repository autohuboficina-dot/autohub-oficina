import { useCallback, useEffect, useRef, useState } from "react";

type ToastType = "success" | "error" | "info";

type ToastMessage = {
  id: number;
  type: ToastType;
  message: string;
};

const toastClasses: Record<ToastType, string> = {
  success: "border-emerald-400/40 bg-emerald-500 text-white",
  error: "border-red-400/40 bg-red-500 text-white",
  info: "border-sky-400/40 bg-sky-500 text-white",
};

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timeoutIds = useRef<number[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((currentToasts) =>
      currentToasts.filter((toast) => toast.id !== id),
    );
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);

      setToasts((currentToasts) => [...currentToasts, { id, type, message }]);

      const timeoutId = window.setTimeout(() => removeToast(id), 3000);
      timeoutIds.current.push(timeoutId);
    },
    [removeToast],
  );

  useEffect(() => {
    const activeTimeoutIds = timeoutIds.current;

    return () => {
      activeTimeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, []);

  function ToastContainer() {
    return (
      <div className="fixed bottom-4 right-4 z-[9999] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-lg border px-4 py-3 text-sm font-semibold shadow-lg shadow-slate-950/30 transition duration-200 ease-out animate-in fade-in slide-in-from-bottom-2 ${toastClasses[toast.type]}`}
            role="status"
          >
            {toast.message}
          </div>
        ))}
      </div>
    );
  }

  return {
    ToastContainer,
    success: (message: string) => showToast("success", message),
    error: (message: string) => showToast("error", message),
    info: (message: string) => showToast("info", message),
  };
}
