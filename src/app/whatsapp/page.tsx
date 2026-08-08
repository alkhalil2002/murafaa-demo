import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { listMessageCommunications } from "@/server/communications";
import { PermissionError } from "@/lib/permissions/guard";
import { RIYADH_TZ } from "@/lib/dates";
import { t } from "@/lib/i18n";

function formatWhen(d: Date): string {
  return new Intl.DateTimeFormat("ar-SA", { timeZone: RIYADH_TZ, dateStyle: "medium", timeStyle: "short" }).format(d);
}

export default async function WhatsappPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const rows = await listMessageCommunications(session);
    content = (
      <>
        <div className="panel">
          <div className="sub" style={{ marginBottom: 0 }}>{t("whatsapp.hint")}</div>
        </div>
        {rows.length === 0 ? (
          <div className="panel">
            <div className="sub" style={{ marginBottom: 0 }}>{t("whatsapp.empty")}</div>
          </div>
        ) : (
          <div className="clist">
            {rows.map((r) => (
              <div key={r.id} className="dcard" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>💬</span>
                <div style={{ flex: 1 }}>
                  <div>{r.note}</div>
                  <div className="sub">
                    {r.case.client?.name ?? "—"}
                    {r.case.client?.phone ? ` · ${r.case.client.phone}` : ""} · {formatWhen(r.createdAt)}
                  </div>
                </div>
                <Link href={`/cases/${r.case.id}`} className="tinybtn">
                  {t("whatsapp.openCase")}
                </Link>
              </div>
            ))}
          </div>
        )}
      </>
    );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return (
    <AppShell>
      <div className="vhead">
        <h2>{t("whatsapp.title")}</h2>
        <span className="pill">{t("whatsapp.pill")}</span>
      </div>
      {content}
    </AppShell>
  );
}
