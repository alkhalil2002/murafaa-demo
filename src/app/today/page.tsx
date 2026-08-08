import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { getTodaySummary, type TodayHearingItem, type TodayDeadlineItem } from "@/server/today";
import { t } from "@/lib/i18n";

/** Arabic-Indic numeral formatting, matching the prototype's `arNum()`. */
const arNum = (n: number) => n.toLocaleString("ar-SA");

/** Urgency colour bands from the prototype's `dlc()` (Today screen only —
 * a simpler 3-band scheme than the 5-band `Urgency` used on /deadlines). */
function urgencyColor(daysLeft: number): string {
  if (daysLeft < 0 || daysLeft <= 2) return "var(--advocate)";
  if (daysLeft <= 7) return "var(--gold)";
  return "var(--ok)";
}

/** Countdown text from the prototype's `dtxt()`. */
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
    <div className="sub" style={{ fontSize: 13, color: "var(--ink-soft)" }}>
      {children}
    </div>
  );
}

/** First-and-last-initial avatar, deterministically colour-hashed from the
 * name (prototype `empAvatar()` without a photo). */
function InitialsAvatar({ name, size }: { name: string; size: number }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("");
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

function EmployeeOfWeekCard({ eow }: { eow: { name: string; roleLabel: string; points: number } }) {
  return (
    <div
      className="panel"
      style={{
        background: "linear-gradient(135deg, rgba(194,151,75,.12), rgba(14,58,48,.06))",
        border: "1px solid var(--gold)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ fontSize: 30 }}>🏆</div>
        <InitialsAvatar name={eow.name} size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sub" style={{ fontSize: 11.5, color: "var(--gold)", fontWeight: 700, letterSpacing: 1, marginBottom: 0 }}>
            {t("pulse.eow.badge")}
          </div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{eow.name}</div>
          <div className="sub" style={{ marginTop: 1, marginBottom: 0 }}>
            {eow.roleLabel}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-amiri), serif", fontSize: 30, fontWeight: 700, color: "var(--gold)", lineHeight: 1 }}>
            {arNum(eow.points)}
          </div>
          <div className="sub" style={{ fontSize: 10, marginBottom: 0 }}>
            {t("pulse.eow.points")}
          </div>
        </div>
      </div>
    </div>
  );
}

function Panel({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>
        <span className="n">{n}</span> {title}
      </h2>
      {children}
    </div>
  );
}

function HearingRow({ item }: { item: TodayHearingItem }) {
  const color = urgencyColor(item.daysLeft);
  return (
    <Row
      href={`/cases/${item.caseId}`}
      color={color}
      label={item.caseTitle}
      chip={urgencyText(item.daysLeft)}
    />
  );
}

function DeadlineRow({ item }: { item: TodayDeadlineItem }) {
  const color = urgencyColor(item.daysLeft);
  return (
    <Row
      href={`/cases/${item.caseId}`}
      color={color}
      label={`${item.label} — ${item.caseTitle}`}
      chip={urgencyText(item.daysLeft)}
    />
  );
}

export default async function TodayPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const summary = await getTodaySummary(session);

  const kpis: Array<[string, number]> = [
    [t("today.kpi.hearings7"), summary.hearings.totalWithin7],
    [t("today.kpi.deadlines7"), summary.deadlines.totalWithin7],
    [t("today.kpi.approvals"), summary.approvals.total],
    [t("today.kpi.tasks"), summary.tasks.total],
  ];

  return (
    <AppShell>
      <div className="vhead">
        <h2>{t("common.today")}</h2>
        <span className="pill">{t("today.pill")}</span>
      </div>

      {summary.employeeOfWeek && <EmployeeOfWeekCard eow={summary.employeeOfWeek} />}

      <div className="kpis">
        {kpis.map(([label, value]) => (
          <div className="kpi" key={label}>
            <div className="v">{arNum(value)}</div>
            <div className="l">{label}</div>
          </div>
        ))}
        {summary.winRate.visible && summary.winRate.pct !== null && (
          <div className="kpi">
            <div className="v">{arNum(summary.winRate.pct)}٪</div>
            <div className="l">{t("today.kpi.winRate")}</div>
          </div>
        )}
      </div>

      <div className="grid2">
        {summary.hearings.visible && (
          <Panel n={t("today.panel.hearings")} title={t("today.panel.hearingsSub")}>
            {summary.hearings.items.length ? (
              summary.hearings.items.map((item, i) => (
                <HearingRow key={`${item.caseId}-${i}`} item={item} />
              ))
            ) : (
              <Empty>{t("today.empty.hearings")}</Empty>
            )}
          </Panel>
        )}
        {summary.deadlines.visible && (
          <Panel n={t("today.panel.deadlines")} title={t("today.panel.deadlinesSub")}>
            {summary.deadlines.items.length ? (
              summary.deadlines.items.map((item, i) => (
                <DeadlineRow key={`${item.caseId}-${i}`} item={item} />
              ))
            ) : (
              <Empty>{t("today.empty.deadlines")}</Empty>
            )}
          </Panel>
        )}
      </div>

      {summary.approvals.visible && (
        <Panel n={t("today.panel.approvals")} title={t("today.panel.approvalsSub")}>
          {summary.approvals.items.length ? (
            summary.approvals.items.map((item) =>
              item.kind === "hrRequest" ? (
                <Link href="/hr/requests" className="approve-row" style={{ cursor: "pointer" }} key={item.id}>
                  <span className="ndot" style={{ background: "var(--bench)" }} />
                  <span className="at">
                    {item.kindLabel} — {item.employeeName}
                    {item.department ? <span className="chip"> {item.department}</span> : null}
                  </span>
                  <span className="chip">{item.statusLabel}</span>
                </Link>
              ) : (
                <Link
                  href={`/cases/${item.caseId}?tab=approvals`}
                  className="approve-row"
                  style={{ cursor: "pointer" }}
                  key={item.id}
                >
                  <span className="ndot" style={{ background: "var(--gold)" }} />
                  <span className="at">
                    {item.title} — {item.caseTitle}
                  </span>
                  <span className="chip">{item.stageLabel}</span>
                </Link>
              ),
            )
          ) : (
            <Empty>{t("today.empty.approvals")}</Empty>
          )}
        </Panel>
      )}

      {summary.tasks.visible && (
        <Panel n={t("today.panel.tasks")} title={t("today.panel.tasksSub")}>
          {summary.tasks.items.length ? (
            summary.tasks.items.map((item) => (
              <Link href="/tasks" className="approve-row" style={{ cursor: "pointer" }} key={item.id}>
                <span
                  className="ndot"
                  style={{ background: item.urgent ? "var(--advocate)" : "var(--ink-soft)" }}
                />
                <span className="at">
                  {item.title}
                  {item.caseTitle ? <span className="chip"> ⚖ {item.caseTitle}</span> : null}
                </span>
                <span className="chip">{item.dueLabel ?? ""}</span>
              </Link>
            ))
          ) : (
            <Empty>{t("today.empty.tasks")}</Empty>
          )}
        </Panel>
      )}
    </AppShell>
  );
}
