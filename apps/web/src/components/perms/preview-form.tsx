"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { permissionsEndPreview, permissionsStartPreview } from "@murafaa/sdk";
import { roleLabel, t } from "@murafaa/i18n";
import { browserApi } from "@/lib/browser-api";

const ROLES = ["PARTNER", "LAWYER", "ASSISTANT", "ACCOUNTANT", "ADMIN", "RECEPTION"] as const;

/** "معاينة حسب الدور": start a view-only preview of another role (legacy /perms panel). */
export function PreviewForm() {
  const router = useRouter();
  const [role, setRole] = useState<(typeof ROLES)[number]>("LAWYER");
  const [pending, startTransition] = useTransition();

  return (
    <form
      style={{ display: "flex", gap: 10, alignItems: "flex-end" }}
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          await permissionsStartPreview({ client: browserApi, body: { role } });
          router.push("/today");
          router.refresh();
        });
      }}
    >
      <select value={role} onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {roleLabel(r)}
          </option>
        ))}
      </select>
      <button type="submit" className="act b-add" disabled={pending}>
        {t("perms.roles.preview.start")}
      </button>
    </form>
  );
}

/** Ends the preview from the banner shown on every screen while previewing. */
export function EndPreviewButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="tinybtn"
      style={{ marginInlineStart: "auto" }}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await permissionsEndPreview({ client: browserApi });
          router.push("/today");
          router.refresh();
        })
      }
    >
      {t("rolePreview.exit")}
    </button>
  );
}
