import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import {
  getPulseRanking,
  getPulseTeamTotals,
  getPulseSelfCard,
  getPulseDrilldown,
  getPerformanceWeights,
  canViewPulseTeam,
  PULSE_WINDOWS,
  type PulseWindow,
} from "@/server/pulse";
import { canAction } from "@/lib/permissions/guard";
import { PermModule } from "@prisma/client";
import { roleLabel, performanceEventKindLabel } from "@/lib/labels";
import { RIYADH_TZ } from "@/lib/dates";
import { t } from "@/lib/i18n";
import { setPerformanceWeightAction, resetPerformanceWeightAction } from "./actions";

const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("ar-SA", { timeZone: RIYADH_TZ, dateStyle: "medium", timeStyle: "short" }).format(d);

function windowLink(base: string, w: PulseWindow) {
  return `${base}?window=${w}`;
}

export default async function PulsePage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string; drill?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { window: windowParam, drill } = await searchParams;
  const window: PulseWindow = (PULSE_WINDOWS as readonly string[]).includes(windowParam ?? "")
    ? (windowParam as PulseWindow)
    : "week";

  const canViewTeam = await canViewPulseTeam(session);
  const selfCard = await getPulseSelfCard(session, window);

  let teamContent: React.ReactNode = null;
  if (canViewTeam) {
    const [ranking, totals, canEditWeights, weights, drilldown] = await Promise.all([
      getPulseRanking(session, window),
      getPulseTeamTotals(session, window),
      canAction(session, PermModule.PULSE, "delete"),
      canAction(session, PermModule.PULSE, "delete").then((can) => (can ? getPerformanceWeights(session) : null)),
      drill ? getPulseDrilldown(session, drill, window) : null,
    ]);

    teamContent = (
      <>
        <div className="kpis" style={{ marginBottom: 16 }}>
          <div className="kpi">
            <div className="v">{totals.totalPoints.toLocaleString("ar-SA")}</div>
            <div className="l">{t("pulse.totals.points")}</div>
          </div>
          <div className="kpi">
            <div className="v">{totals.tasksCompleted.toLocaleString("ar-SA")}</div>
            <div className="l">{t("pulse.totals.tasks")}</div>
          </div>
          <div className="kpi">
            <div className="v">{totals.hearingsLogged.toLocaleString("ar-SA")}</div>
            <div className="l">{t("pulse.totals.hearings")}</div>
          </div>
        </div>
        <div className="panel">
          {ranking.length === 0 ? (
            <div className="sub" style={{ marginBottom: 0 }}>
              {t("pulse.empty")}
            </div>
          ) : (
            ranking.map((row, i) => (
              <div key={row.userId}>
                <div className="approve-row">
                  <span className="ndot" style={{ background: i === 0 ? "var(--gold)" : "var(--ink-soft)" }} />
                  <span className="at">
                    {row.name}
                    {row.role && <span className="chip"> {roleLabel(row.role)}</span>}
                  </span>
                  <span className="chip" style={{ color: "var(--gold)", borderColor: "var(--gold)" }}>
                    {row.points.toLocaleString("ar-SA")} {t("pulse.points")}
                  </span>
                  <Link href={`/pulse?window=${window}&drill=${row.userId}`} className="tinybtn">
                    {t("pulse.drill")}
                  </Link>
                </div>
                {drill === row.userId && drilldown && (
                  <div style={{ padding: "0 0 12px 24px" }}>
                    {drilldown.events.length === 0 ? (
                      <div className="sub">{t("pulse.self.noActivity")}</div>
                    ) : (
                      drilldown.events.map((ev) => (
                        <div key={ev.id} className="sub" style={{ fontSize: 15 }}>
                          · {performanceEventKindLabel(ev.kind)} (+{ev.points}) — {fmtDateTime(ev.occurredAt)}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        {canEditWeights && weights && (
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>{t("pulse.weights.title")}</h2>
            {weights.map((w) => (
              <form
                key={w.kind}
                action={setPerformanceWeightAction}
                className="approve-row"
                style={{ gap: 8, alignItems: "center" }}
              >
                <input type="hidden" name="kind" value={w.kind} />
                <span className="at">{performanceEventKindLabel(w.kind)}</span>
                <input type="number" name="points" min="0" defaultValue={w.points} style={{ width: 80 }} />
                {w.isDefault && <span className="chip">{t("pulse.weights.default")}</span>}
                <button type="submit" className="tinybtn">
                  {t("pulse.weights.save")}
                </button>
                {!w.isDefault && (
                  <button type="submit" formAction={resetPerformanceWeightAction} className="tinybtn del">
                    {t("pulse.weights.reset")}
                  </button>
                )}
              </form>
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <AppShell>
      <div className="vhead">
        <h2>{t("pulse.title")}</h2>
        <span className="pill">{t("pulse.pill")}</span>
      </div>
      <div className="chips" style={{ marginBottom: 16 }}>
        {PULSE_WINDOWS.map((w) => (
          <Link key={w} href={windowLink("/pulse", w)} className={`chip${w === window ? " st done" : ""}`}>
            {t(`pulse.window.${w}` as never)}
          </Link>
        ))}
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("pulse.self.title")}</h2>
        <div className="kpis" style={{ marginBottom: 12 }}>
          <div className="kpi">
            <div className="v">{selfCard.points.toLocaleString("ar-SA")}</div>
            <div className="l">{t("pulse.points")}</div>
          </div>
          <div className="kpi">
            <div className="v">{selfCard.tasksDone.toLocaleString("ar-SA")}</div>
            <div className="l">{t("pulse.self.tasksDone")}</div>
          </div>
          <div className="kpi">
            <div className="v">%{selfCard.completionRatePct.toLocaleString("ar-SA")}</div>
            <div className="l">{t("pulse.self.completionRate")}</div>
          </div>
        </div>
        <div className="sub" style={{ fontWeight: 600, marginBottom: 6 }}>
          {t("pulse.self.recentActivity")}
        </div>
        {selfCard.events.length === 0 ? (
          <div className="sub">{t("pulse.self.noActivity")}</div>
        ) : (
          selfCard.events.map((ev) => (
            <div key={ev.id} className="sub" style={{ fontSize: 15.625 }}>
              · {performanceEventKindLabel(ev.kind)} (+{ev.points}) — {fmtDateTime(ev.occurredAt)}
            </div>
          ))
        )}
      </div>

      {teamContent}
    </AppShell>
  );
}
