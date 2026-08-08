import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PermsTabs } from "@/components/perms-tabs";
import { getSession } from "@/lib/auth/session";
import { listSecurityAudit } from "@/server/security-audit";
import { RIYADH_TZ } from "@/lib/dates";
import { t } from "@/lib/i18n";

function formatWhen(d: Date): string {
  return new Intl.DateTimeFormat("ar-SA", { timeZone: RIYADH_TZ, dateStyle: "medium", timeStyle: "short" }).format(d);
}

export default async function PermsAuditPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const rows = await listSecurityAudit(session);
    content = (
      <div className="panel">
        <div className="sub" style={{ marginBottom: 12 }}>{t("perms.audit.hint")}</div>
        {rows.length === 0 ? (
          <div className="sub" style={{ marginBottom: 0 }}>{t("perms.audit.empty")}</div>
        ) : (
          <div className="clist">
            {rows.map((r) => (
              <div key={r.id} className="dcard">
                <div style={{ flex: 1 }}>
                  <div>{r.action}{r.detail ? ` — ${r.detail}` : ""}</div>
                  <div className="sub">{r.actorName ?? t("common.system")} · {formatWhen(r.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  } catch {
    content = (
      <div className="panel">
        <div className="sub" style={{ marginBottom: 0 }}>{t("perms.denied")}</div>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="vhead">
        <h2>{t("perms.title")}</h2>
        <span className="pill">{t("perms.pill")}</span>
      </div>
      <PermsTabs />
      {content}
    </AppShell>
  );
}
