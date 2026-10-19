import Link from "next/link";
import { authCurrent, pulseDrill, pulseSelf, pulseTeam, pulseWeights } from "@murafaa/sdk";
import { formatWhen, roleLabel, t, type MessageKey } from "@murafaa/i18n";
import { PULSE_WINDOWS, type PulseWindow } from "@murafaa/rules";
import { WeightForm } from "@/components/hr/hr-forms";
import { serverApi } from "@/lib/api";

type Event = { id: string; kind: string; points: number; occurredAt: string };

function EventLine({ ev, size }: { ev: Event; size: number }) {
  return (
    <div className="sub" style={{ fontSize: size }}>
      · {t(`performanceEventKind.${ev.kind}` as MessageKey)} (+{ev.points.toLocaleString("ar-SA")})
      — {formatWhen(ev.occurredAt)}
    </div>
  );
}

/**
 * نبض الفريق (legacy /pulse): my own card for everyone; the team ranking,
 * drill-down and point weights for the roles that have them.
 */
export default async function PulsePage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string; drill?: string }>;
}) {
  const { window: w, drill } = await searchParams;
  const window: PulseWindow = (PULSE_WINDOWS as readonly string[]).includes(w ?? "")
    ? (w as PulseWindow)
    : "week";
  const api = await serverApi();
  const query = { window };
  const [self, me] = await Promise.all([
    pulseSelf({ client: api, query }),
    authCurrent({ client: api }),
  ]);
  const level = me.data?.data.modules.PULSE ?? "NONE";
  const canTeam = level !== "NONE";
  const canWeights = level === "FULL" && !me.data?.data.user.previewRole;
  const [team, weights, drilldown] = await Promise.all([
    canTeam ? pulseTeam({ client: api, query }) : null,
    canWeights ? pulseWeights({ client: api }) : null,
    canTeam && drill ? pulseDrill({ client: api, path: { id: drill }, query }) : null,
  ]);
  const card = self.data?.data;
  const n = (v: number) => v.toLocaleString("ar-SA");
  return (
    <>
      <div className="vhead">
        <h2>{t("pulse.title")}</h2>
        <span className="pill">{t("pulse.pill")}</span>
      </div>
      <div className="chips" style={{ marginBottom: 16 }}>
        {PULSE_WINDOWS.map((x) => (
          <Link
            key={x}
            href={`/pulse?window=${x}`}
            className={`chip${x === window ? " st done" : ""}`}
          >
            {t(`pulse.window.${x}` as MessageKey)}
          </Link>
        ))}
      </div>

      {card && (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>{t("pulse.self.title")}</h2>
          <div className="kpis" style={{ marginBottom: 12 }}>
            <div className="kpi">
              <div className="v">{n(card.points)}</div>
              <div className="l">{t("pulse.points")}</div>
            </div>
            <div className="kpi">
              <div className="v">{n(card.tasksDone)}</div>
              <div className="l">{t("pulse.self.tasksDone")}</div>
            </div>
            <div className="kpi">
              <div className="v">{t("common.percent", { n: n(card.completionRatePct) })}</div>
              <div className="l">{t("pulse.self.completionRate")}</div>
            </div>
          </div>
          <div className="sub" style={{ fontWeight: 600, marginBottom: 6 }}>
            {t("pulse.self.recentActivity")}
          </div>
          {card.events.length === 0 ? (
            <div className="sub">{t("pulse.self.noActivity")}</div>
          ) : (
            card.events.map((ev) => <EventLine key={ev.id} ev={ev} size={15.625} />)
          )}
        </div>
      )}

      {team?.data && (
        <>
          <div className="kpis" style={{ marginBottom: 16 }}>
            <div className="kpi">
              <div className="v">{n(team.data.data.totals.totalPoints)}</div>
              <div className="l">{t("pulse.totals.points")}</div>
            </div>
            <div className="kpi">
              <div className="v">{n(team.data.data.totals.tasksCompleted)}</div>
              <div className="l">{t("pulse.totals.tasks")}</div>
            </div>
            <div className="kpi">
              <div className="v">{n(team.data.data.totals.hearingsLogged)}</div>
              <div className="l">{t("pulse.totals.hearings")}</div>
            </div>
          </div>
          <div className="panel">
            {team.data.data.ranking.length === 0 ? (
              <div className="sub" style={{ marginBottom: 0 }}>
                {t("pulse.empty")}
              </div>
            ) : (
              team.data.data.ranking.map((row, i) => (
                <div key={row.userId}>
                  <div className="approve-row">
                    <span
                      className="ndot"
                      style={{ background: i === 0 ? "var(--amber-600)" : "var(--ink-soft)" }}
                    />
                    <span className="at">
                      {row.name}
                      <span className="chip"> {roleLabel(row.role)}</span>
                    </span>
                    <span
                      className="chip"
                      style={{ color: "var(--amber-600)", borderColor: "var(--amber-400)" }}
                    >
                      {n(row.points)} {t("pulse.points")}
                    </span>
                    <Link href={`/pulse?window=${window}&drill=${row.userId}`} className="tinybtn">
                      {t("pulse.drill")}
                    </Link>
                  </div>
                  {drill === row.userId && drilldown?.data && (
                    <div style={{ padding: "0 0 12px 24px" }}>
                      {drilldown.data.data.events.length === 0 ? (
                        <div className="sub">{t("pulse.self.noActivity")}</div>
                      ) : (
                        drilldown.data.data.events.map((ev) => (
                          <EventLine key={ev.id} ev={ev} size={15} />
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {weights?.data && (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>{t("pulse.weights.title")}</h2>
          {weights.data.data.map((wt) => (
            <WeightForm key={wt.kind} kind={wt.kind} points={wt.points} isDefault={wt.isDefault} />
          ))}
        </div>
      )}
    </>
  );
}
