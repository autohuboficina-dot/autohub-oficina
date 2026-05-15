import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastType = "success" | "error" | "info" | "warning";

type ToastMessage = {
  id: number;
  type: ToastType;
  message: string;
};

type ToastOptions = {
  duration?: number;
};

type ToastContextValue = {
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
  warning: (message: string, options?: ToastOptions) => void;
  ToastContainer: () => null;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toastClasses: Record<ToastType, string> = {
  success: "border-emerald-400/40 bg-emerald-500 text-white",
  error: "border-red-400/40 bg-red-500 text-white",
  info: "border-sky-400/40 bg-sky-500 text-white",
  warning: "border-amber-400/40 bg-amber-500 text-slate-950",
};

function ToastContainer() {
  return null;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timeoutIds = useRef<number[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((currentToasts) =>
      currentToasts.filter((toast) => toast.id !== id),
    );
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, options: ToastOptions = {}) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);

      setToasts((currentToasts) => [...currentToasts, { id, type, message }]);

      const timeoutId = window.setTimeout(
        () => removeToast(id),
        options.duration ?? 3000,
      );
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

  const value = useMemo<ToastContextValue>(
    () => ({
      ToastContainer,
      success: (message, options) => showToast("success", message, options),
      error: (message, options) => showToast("error", message, options),
      info: (message, options) => showToast("info", message, options),
      warning: (message, options) => showToast("warning", message, options),
    }),
    [showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-3 max-sm:inset-x-4 max-sm:w-auto">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-lg border px-4 py-3 text-sm font-semibold shadow-lg shadow-slate-950/30 transition duration-200 ease-out animate-in fade-in slide-in-from-bottom-2 ${toastClasses[toast.type]}`}
            role={toast.type === "error" ? "alert" : "status"}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast deve ser usado dentro de ToastProvider.");
  }

  return context;
}
