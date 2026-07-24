import { redirect } from "next/navigation";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { HrTabs } from "@/components/hr-tabs";
import { Pill, StatCard } from "@/components/hr-ui";
import { getSession } from "@/lib/auth/session";
import { getSaudizationStatus } from "@/server/hr/saudization";
import { PermissionError } from "@/lib/permissions/guard";
import { nitaqatBandLabel } from "@/lib/labels";
import { t } from "@/lib/i18n";

const BAND_TONE: Record<string, "ok" | "warn" | "bad" | "gold"> = {
  PLATINUM: "ok",
  HIGH_GREEN: "ok",
  MID_GREEN: "ok",
  LOW_GREEN: "gold",
  YELLOW: "warn",
  RED: "bad",
};

export default async function SaudizationPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const sz = await getSaudizationStatus(session);
    content = (
      <>
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label={t("hr.saudizationPct")} value={`${Math.round(sz.pct)}%`} />
          <div className="rounded-2xl border border-line bg-white p-4">
            <div className="text-xs text-ink-soft">{t("hr.sz.target")}</div>
            <div className="mt-2"><Pill tone={BAND_TONE[sz.band]}>{nitaqatBandLabel(sz.band)}</Pill></div>
          </div>
          <StatCard label={t("hr.kpi.staff")} value={String(sz.total)} />
          <StatCard label={t("hr.sz.saudis")} value={`${sz.saudiCount} / ${sz.total}`} />
        </div>

        {sz.targets.length === 0 ? (
          <p className="text-ink-soft">—</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full text-right text-sm">
              <thead className="border-b border-line text-ink-soft">
                <tr>
                  <th className="p-3 font-medium">{t("hr.sz.target")}</th>
                  <th className="p-3 font-medium">{t("hr.saudizationPct")}</th>
                  <th className="p-3 font-medium">{t("hr.sz.needed")}</th>
                </tr>
              </thead>
              <tbody>
                {sz.targets.map((tg) => (
                  <tr key={tg.key} className="border-b border-parch-line last:border-0">
                    <td className="p-3"><Pill tone={BAND_TONE[tg.key]}>{nitaqatBandLabel(tg.key)}</Pill></td>
                    <td className="p-3 text-ink-soft">≥ {tg.minPct}%</td>
                    <td className="p-3">{tg.saudisNeeded}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  } catch (e) {
    if (e instanceof PermissionError) content = <DeniedPanel />;
    else throw e;
  }

  return (
    <AppShell>
      <h1 className="mb-4 font-serif text-3xl text-bench">{t("hr.title")}</h1>
      <HrTabs />
      {content}
    </AppShell>
  );
}
