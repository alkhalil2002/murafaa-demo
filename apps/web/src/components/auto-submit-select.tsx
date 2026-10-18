"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { t, type MessageKey } from "@murafaa/i18n";

/**
 * A <select> that saves on change (legacy auto-submit-select). `save` calls the
 * API; on success the page re-renders from the server, on failure the API's
 * message is shown and the old value stays.
 */
export function AutoSubmitSelect({
  value,
  options,
  save,
  label,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  save: (value: string) => Promise<{ error?: unknown }>;
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<MessageKey | null>(null);

  return (
    <>
      <select
        value={value}
        disabled={pending}
        aria-label={label}
        onChange={(e) => {
          const next = e.target.value;
          setError(null);
          startTransition(async () => {
            const res = await save(next);
            if (res.error) {
              const key = (res.error as { error?: { messageKey?: string } }).error?.messageKey;
              setError((key ?? "auth.error.generic") as MessageKey);
            }
            router.refresh();
          });
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <div className="lerr">{t(error)}</div>}
    </>
  );
}
