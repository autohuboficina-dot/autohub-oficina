import { useCallback, useState } from "react";
import { useToast } from "../components/Toast";

interface UseAsyncActionOptions {
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

export function useAsyncAction<Args extends unknown[], Result>(
  action: (...args: Args) => Result | Promise<Result>,
  options: UseAsyncActionOptions = {},
) {
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const execute = useCallback(
    async (...args: Args) => {
      if (loading) {
        return undefined;
      }

      setLoading(true);
      try {
        const result = await action(...args);

        if (options.successMessage) {
          toast.success(options.successMessage);
        }

        options.onSuccess?.();
        return result;
      } catch (error) {
        const message =
          options.errorMessage ??
          (error instanceof Error ? error.message : "Erro ao processar ação");

        toast.error(message);
        options.onError?.(error);
        console.error("[useAsyncAction]", error);
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [action, loading, options, toast],
  );

  return { execute, loading };
}
