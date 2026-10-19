"use client";

import { usePathname, useRouter } from "next/navigation";

/** Case filter for the portal's documents and chat pages; the choice lives in ?case=. */
export function CasePicker({
  cases,
  value,
  allLabel,
}: {
  cases: Array<{ id: string; title: string }>;
  value: string;
  /** Offered as an empty first option when set. */
  allLabel?: string;
}) {
  const router = useRouter();
  const path = usePathname();
  return (
    <div className="filters">
      <select
        className="input"
        style={{ width: 320, maxWidth: "100%" }}
        value={value}
        onChange={(e) => router.push(e.target.value ? `${path}?case=${e.target.value}` : path)}
      >
        {allLabel && <option value="">{allLabel}</option>}
        {cases.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
    </div>
  );
}
