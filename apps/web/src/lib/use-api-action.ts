"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { MessageKey } from "@murafaa/i18n";
import { apiErrorKey } from "./api-error";

/**
 * Run an API call from a form or button: on success re-render the page from
 * the server; on failure keep the form and expose the API's message key.
 */
export function useApiAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<MessageKey | null>(null);

  function run(call: () => Promise<{ error?: unknown }>, onSuccess?: () => void) {
    startTransition(async () => {
      setError(null);
      const res = await call();
      if (res.error) {
        setError(apiErrorKey(res.error));
        return;
      }
      onSuccess?.();
      router.refresh();
    });
  }

  return { run, pending, error };
}
