import { redirect } from "next/navigation";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { getPulseRanking } from "@/server/pulse";
import { PermissionError } from "@/lib/permissions/guard";
import { roleLabel } from "@/lib/labels";
import { t } from "@/lib/i18n";

export default async function PulsePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const ranking = await getPulseRanking(session);
    content = (
      <div className="panel">
        {ranking.length === 0 ? (
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("pulse.empty")}
          </div>
        ) : (
          ranking.map((row, i) => (
            <div className="approve-row" key={row.userId}>
              <span className="ndot" style={{ background: i === 0 ? "var(--gold)" : "var(--ink-soft)" }} />
              <span className="at">
                {row.name}
                {row.role && <span className="chip"> {roleLabel(row.role)}</span>}
              </span>
              <span className="chip" style={{ color: "var(--gold)", borderColor: "var(--gold)" }}>
                {row.points.toLocaleString("ar-SA")} {t("pulse.points")}
              </span>
            </div>
          ))
        )}
      </div>
    );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return (
    <AppShell>
      <div className="vhead">
        <h2>{t("pulse.title")}</h2>
        <span className="pill">{t("pulse.pill")}</span>
      </div>
      {content}
    </AppShell>
  );
}
