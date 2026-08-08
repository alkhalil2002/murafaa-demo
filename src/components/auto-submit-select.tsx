"use client";

import { useTransition } from "react";

/** Generic <select> that fires a server action on change (no submit button). */
export function AutoSubmitSelect({
  action,
  hidden,
  name,
  value,
  options,
  className,
}: {
  action: (formData: FormData) => Promise<void>;
  hidden: Record<string, string>;
  name: string;
  value: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={value}
      disabled={pending}
      className={className}
      onChange={(e) => {
        const fd = new FormData();
        for (const [k, v] of Object.entries(hidden)) fd.set(k, v);
        fd.set(name, e.target.value);
        startTransition(() => {
          void action(fd);
        });
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
