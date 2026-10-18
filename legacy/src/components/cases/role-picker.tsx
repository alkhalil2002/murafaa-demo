"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";

type Role = "PLAINTIFF" | "DEFENDANT";

/** Client-role selector (`.roles`/`.role` cards), matching the prototype's
 * setRole() toggle. Submits via a hidden input so the surrounding form stays
 * a plain server action. */
export function RolePicker({ defaultValue = "PLAINTIFF" }: { defaultValue?: Role }) {
  const [role, setRole] = useState<Role>(defaultValue);
  return (
    <div className="roles">
      <input type="hidden" name="clientRole" value={role} />
      <div
        className={`role plaintiff${role === "PLAINTIFF" ? " sel" : ""}`}
        onClick={() => setRole("PLAINTIFF")}
      >
        <b>{t("cases.role.plaintiff")}</b>
        <small>{t("cases.new.plaintiffHint")}</small>
      </div>
      <div
        className={`role defendant${role === "DEFENDANT" ? " sel" : ""}`}
        onClick={() => setRole("DEFENDANT")}
      >
        <b>{t("cases.role.defendant")}</b>
        <small>{t("cases.new.defendantHint")}</small>
      </div>
    </div>
  );
}
