import Link from "next/link";
import { overviewToday } from "@murafaa/sdk";
import { roleLabel, t, type MessageKey } from "@murafaa/i18n";
import type { Role } from "@murafaa/auth";
import { serverApi } from "@/lib/api";

const arNum = (n: number) => n.toLocaleString("ar-SA");

/** Three-band colour from the prototype's dlc() (Today only). */
function urgencyColor(daysLeft: number): string {
  if (daysLeft <= 2) return "var(--advocate)";
  if (daysLeft <= 7) return "var(--amber-600)";
  return "var(--ok)";
}

/** Countdown text from the prototype's dtxt(). */
function urgencyText(daysLeft: number): string {
  if (daysLeft < 0) return t("today.since", { n: arNum(Math.abs(daysLeft)) });
  if (daysLeft === 0) return t("common.today");
  return t("today.within", { n: arNum(daysLeft) });
}

function Row({
  href,
  color,
  label,
  chip,
}: {
  href: string;
  color: string;
  label: React.ReactNode;
  chip: React.ReactNode;
}) {
  return (
    <Link href={href} className="approve-row" style={{ cursor: "pointer" }}>
      <span className="ndot" style={{ background: color }} />
      <span className="at">{label}</span>
      <span className="chip" style={{ color, borderColor: color }}>
        {chip}
      </span>
    </Link>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="sub" style={{ fontSize: 16.25, color: "var(--ink-soft)" }}>
      {children}
    </div>
  );
}

function Panel({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>
        <span className="n">{n}</span> {title}
      </h2>
      {children}
    </div>
  );
}

/** Initials avatar, colour-hashed from the name (prototype empAvatar() without a photo). */
function InitialsAvatar({ name, size }: { name: string; size: number }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        background: `hsl(${hash}, 35%, 42%)`,
        color: "#fff",
        fontWeight: 700,
        fontSize: Math.round(size * 0.4),
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  );
}

const DEADLINE_LABEL: Record<string, MessageKey> = {
  objection: "deadlines.objection",
  poa: "deadlines.poa",
  reminder: "deadlines.reminder",
};

/** اليوم (legacy today page, prototype renderToday). Sections the role lacks are not shown. */
export default async function TodayPage() {
  const api = await serverApi();
  const s = (await overviewToday({ client: api })).data?.data;
  if (!s) return null;
  const kpis: Array<[string, number]> = [
    [t("today.kpi.hearings7"), s.hearings.totalWithin7],
    [t("today.kpi.deadlines7"), s.deadlines.totalWithin7],
    [t("today.kpi.approvals"), s.approvals.total],
    [t("today.kpi.tasks"), s.tasks.total],
  ];
  const eow = s.employeeOfWeek;

  return (
    <>
      <div className="vhead">
        <h2>{t("common.today")}</h2>
        <span className="pill">{t("today.pill")}</span>
      </div>

      {eow && (
        <div
          className="panel"
          style={{
            background: "linear-gradient(135deg, rgba(194,151,75,.12), rgba(14,58,48,.06))",
            border: "1px solid var(--amber-400)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 37.5 }}>🏆</div>
            <InitialsAvatar name={eow.name} size={52} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="sub"
                style={{
                  fontSize: 14.375,
                  color: "var(--amber-600)",
                  fontWeight: 700,
                  letterSpacing: 1,
                  marginBottom: 0,
                }}
              >
                {t("pulse.eow.badge")}
              </div>
              <div style={{ fontWeight: 700, fontSize: 21.25 }}>{eow.name}</div>
              <div className="sub" style={{ marginTop: 1, marginBottom: 0 }}>
                {roleLabel(eow.role as Role)}
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "var(--font-amiri), serif",
                  fontSize: 37.5,
                  fontWeight: 700,
                  color: "var(--amber-600)",
                  lineHeight: 1,
                }}
              >
                {arNum(eow.points)}
              </div>
              <div className="sub" style={{ fontSize: 12.5, marginBottom: 0 }}>
                {t("pulse.eow.points")}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="kpis">
        {kpis.map(([label, value]) => (
          <div className="kpi" key={label}>
            <div className="v">{arNum(value)}</div>
            <div className="l">{label}</div>
          </div>
        ))}
        {s.winRate.visible && s.winRate.pct !== null && (
          <div className="kpi">
            <div className="v">{t("common.percent", { n: arNum(s.winRate.pct) })}</div>
            <div className="l">{t("today.kpi.winRate")}</div>
          </div>
        )}
      </div>

      <div className="grid2">
        {s.hearings.visible && (
          <Panel n={t("today.panel.hearings")} title={t("today.panel.hearingsSub")}>
            {s.hearings.items.length ? (
              s.hearings.items.map((item, i) => (
                <Row
                  key={`${item.caseId}-${i}`}
                  href={`/cases/${item.caseId}`}
                  color={urgencyColor(item.daysLeft)}
                  label={item.caseTitle}
                  chip={urgencyText(item.daysLeft)}
                />
              ))
            ) : (
              <Empty>{t("today.empty.hearings")}</Empty>
            )}
          </Panel>
        )}
        {s.deadlines.visible && (
          <Panel n={t("today.panel.deadlines")} title={t("today.panel.deadlinesSub")}>
            {s.deadlines.items.length ? (
              s.deadlines.items.map((item, i) => (
                <Row
                  key={`${item.caseId}-${i}`}
                  href={`/cases/${item.caseId}`}
                  color={urgencyColor(item.daysLeft)}
                  label={`${item.kind === "reminder" && item.label ? item.label : t(DEADLINE_LABEL[item.kind] ?? "deadlines.reminder")} — ${item.caseTitle}`}
                  chip={urgencyText(item.daysLeft)}
                />
              ))
            ) : (
              <Empty>{t("today.empty.deadlines")}</Empty>
            )}
          </Panel>
        )}
      </div>

      {s.approvals.visible && (
        <Panel n={t("today.panel.approvals")} title={t("today.panel.approvalsSub")}>
          {s.approvals.items.length ? (
            s.approvals.items.map((item) => (
              <Link
                href={`/cases/${item.caseId}?tab=approvals`}
                className="approve-row"
                style={{ cursor: "pointer" }}
                key={item.id}
              >
                <span className="ndot" style={{ background: "var(--amber-400)" }} />
                <span className="at">
                  {item.title} — {item.caseTitle}
                </span>
                <span className="chip">{t(`approvalStage.${item.stage}` as MessageKey)}</span>
              </Link>
            ))
          ) : (
            <Empty>{t("today.empty.approvals")}</Empty>
          )}
        </Panel>
      )}

      {s.tasks.visible && (
        <Panel n={t("today.panel.tasks")} title={t("today.panel.tasksSub")}>
          {s.tasks.items.length ? (
            s.tasks.items.map((item) => (
              <Link
                href="/tasks"
                className="approve-row"
                style={{ cursor: "pointer" }}
                key={item.id}
              >
                <span
                  className="ndot"
                  style={{ background: item.urgent ? "var(--advocate)" : "var(--ink-soft)" }}
                />
                <span className="at">
                  {item.title}
                  {item.caseTitle ? <span className="chip"> ⚖ {item.caseTitle}</span> : null}
                </span>
                <span className="chip">{item.dueOn ?? ""}</span>
              </Link>
            ))
          ) : (
            <Empty>{t("today.empty.tasks")}</Empty>
          )}
        </Panel>
      )}
    </>
  );
}
