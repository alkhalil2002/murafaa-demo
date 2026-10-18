"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { securitySetIpAllowlist } from "@murafaa/sdk";
import { t, type MessageKey } from "@murafaa/i18n";
import { apiErrorKey } from "@/lib/api-error";
import { browserApi } from "@/lib/browser-api";

/** Office IP allowlist editor, one entry per line (partner only). */
export function IpAllowlistPanel({ entries }: { entries: string[] }) {
  const router = useRouter();
  const [text, setText] = useState(entries.join("\n"));
  const [error, setError] = useState<MessageKey | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>{t("security.ip.title")}</h2>
      <div className="sub">{t("security.ip.hint")}</div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            setError(null);
            const res = await securitySetIpAllowlist({
              client: browserApi,
              body: { entries: text.split("\n") },
            });
            if (res.error) {
              setError(apiErrorKey(res.error));
              return;
            }
            setText(res.data.data.entries.join("\n"));
            router.refresh();
          });
        }}
      >
        <textarea
          rows={5}
          dir="ltr"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"203.0.113.5\n198.51.100.0/24"}
          style={{ width: "100%", fontFamily: "monospace" }}
        />
        <div className="actions" style={{ marginTop: 8 }}>
          <button type="submit" className="act b-add" disabled={pending}>
            {t("security.ip.save")}
          </button>
        </div>
      </form>
      {error && <div className="lerr">{t(error)}</div>}
    </div>
  );
}
