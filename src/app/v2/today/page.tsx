import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { SealMark, ScaleMark } from "@/components/v2/marks";
import { getTodaySummary, type TodayHearingItem, type TodayDeadlineItem } from "@/server/today";
import { t } from "@/lib/i18n";

/**
 * Today — v2 ("محضر" / the record).
 *
 * Same data, same gates, same i18n keys as `src/app/today/page.tsx`; only the
 * presentation differs. Nothing here queries Prisma directly — it reads the
 * identical `getTodaySummary` aggregate, so every module gate and row scope
 * still applies and a role missing a module still sees that section omitted.
 */

const arNum = (n: number) => n.toLocaleString("ar-SA");

/* Severity ramp — same 3 bands as v1's `dlc()`, mapped onto v2 tokens. */
function urgencyAccent(daysLeft: number): string {
  if (daysLeft < 0 || daysLeft <= 2) return "var(--adv-600)";
  if (daysLeft <= 7) return "var(--gold-600)";
  return "var(--ok-500)";
}

function urgencyText(daysLeft: number): string {
  if (daysLeft < 0) return t("today.since", { n: arNum(Math.abs(daysLeft)) });
  if (daysLeft === 0) return t("common.today");
  return t("today.within", { n: arNum(daysLeft) });
}

function Row({
  href,
  accent,
  label,
  chip,
  chipAccent = false,
}: {
  href: string;
  accent: string;
  label: React.ReactNode;
  chip: React.ReactNode;
  chipAccent?: boolean;
}) {
  return (
    <Link href={href} className="v2-row" style={{ ["--accent" as string]: accent }}>
      <span className="label">{label}</span>
      <span className={chipAccent ? "v2-chip is-accent" : "v2-chip"}>{chip}</span>
    </Link>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="v2-empty">
      <span className="rule" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

/** Deterministic initials avatar, colour-hashed from the name. */
function InitialsAvatar({ name, size }: { name: string; size: number }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("");
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span
      className="v2-avatar"
      style={{
        width: size,
        height: size,
        background: `hsl(${hash} 32% 38%)`,
        fontSize: Math.round(size * 0.38),
      }}
    >
      {initials}
    </span>
  );
}

function Section({
  n,
  title,
  count,
  order,
  children,
}: {
  n: string;
  title: string;
  count?: number;
  order: number;
  children: React.ReactNode;
}) {
  return (
    <section className="v2-section v2-rise" style={{ ["--i" as string]: order }}>
      <div className="v2-shead">
        <span className="mark" aria-hidden="true">
          {n}
        </span>
        <h2>{title}</h2>
        {count !== undefined && count > 0 && <span className="count">{arNum(count)}</span>}
      </div>
      {children}
    </section>
  );
}

export default async function TodayV2Page() {
  const session = await getSession();
  if (!session) redirect("/login");

  const summary = await getTodaySummary(session);

  /* Both calendars — a Saudi legal deadline is counted in one and filed in
     the other. Locale-formatted, so no Arabic strings are hardcoded here. */
  const now = new Date();
  const gregorian = now.toLocaleDateString("ar-SA-u-ca-gregory", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const hijri = now.toLocaleDateString("ar-SA-u-ca-islamic-umalqura", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  /* `urgent` promotes a cell's rule to full strength — reserved for the two
     things that carry a real deadline consequence (a lapsed objection window
     is unrecoverable; a stalled approval blocks the file). Counts that are
     merely non-zero stay at the muted step. */
  const cells: Array<{
    label: string;
    value: string;
    accent: string;
    quiet?: boolean;
    urgent?: boolean;
  }> = [
    {
      label: t("today.kpi.hearings7"),
      value: arNum(summary.hearings.totalWithin7),
      accent: "var(--bench-700)",
      quiet: summary.hearings.totalWithin7 === 0,
    },
    {
      label: t("today.kpi.deadlines7"),
      value: arNum(summary.deadlines.totalWithin7),
      accent: summary.deadlines.totalWithin7 > 0 ? "var(--adv-600)" : "var(--bench-700)",
      quiet: summary.deadlines.totalWithin7 === 0,
      urgent: summary.deadlines.totalWithin7 > 0,
    },
    {
      label: t("today.kpi.approvals"),
      value: arNum(summary.approvals.total),
      accent: summary.approvals.total > 0 ? "var(--gold-600)" : "var(--bench-700)",
      quiet: summary.approvals.total === 0,
      urgent: summary.approvals.total > 0,
    },
    {
      label: t("today.kpi.tasks"),
      value: arNum(summary.tasks.total),
      accent: "var(--bench-700)",
      quiet: summary.tasks.total === 0,
    },
  ];

  if (summary.winRate.visible && summary.winRate.pct !== null) {
    cells.push({
      label: t("today.kpi.winRate"),
      value: `${arNum(summary.winRate.pct)}٪`,
      accent: "var(--ok-500)",
    });
  }

  return (
    <AppShell>
      <div className="v2">
        <header className="v2-masthead v2-rise" style={{ ["--i" as string]: 0 }}>
          <div>
            <h1>{t("common.today")}</h1>
            <p className="lede">{t("today.pill")}</p>
          </div>
          <div className="v2-datestack">
            <div className="greg">{gregorian}</div>
            <div className="hijri">{hijri}</div>
          </div>
        </header>

        <div className="v2-topgrid v2-rise" style={{ ["--i" as string]: 1 }}>
          <div className="v2-docket">
            {cells.map((c) => (
              <div
                className={`v2-cell${c.quiet ? " is-quiet" : ""}${c.urgent ? " is-urgent" : ""}`}
                key={c.label}
                style={{ ["--accent" as string]: c.accent }}
              >
                <div className="v">{c.value}</div>
                <div className="l">{c.label}</div>
              </div>
            ))}
          </div>

          {summary.employeeOfWeek && (
            <div className="v2-seal-card">
              <div className="top">
                <span className="seal">
                  <SealMark size={34} />
                </span>
                <InitialsAvatar name={summary.employeeOfWeek.name} size={40} />
                <div className="who">
                  <div className="badge">{t("pulse.eow.badge")}</div>
                  <div className="name">{summary.employeeOfWeek.name}</div>
                  <div className="v2-role">{summary.employeeOfWeek.roleLabel}</div>
                </div>
              </div>
              <div className="score">
                <span className="n">{arNum(summary.employeeOfWeek.points)}</span>
                <span className="u">{t("pulse.eow.points")}</span>
              </div>
            </div>
          )}
        </div>

        <div className="v2-cols">
          {summary.hearings.visible && (
            <Section
              n="١"
              title={`${t("today.panel.hearings")} ${t("today.panel.hearingsSub")}`}
              count={summary.hearings.items.length}
              order={3}
            >
              {summary.hearings.items.length ? (
                summary.hearings.items.map((item: TodayHearingItem, i) => (
                  <Row
                    key={`${item.caseId}-${i}`}
                    href={`/cases/${item.caseId}`}
                    accent={urgencyAccent(item.daysLeft)}
                    label={item.caseTitle}
                    chip={urgencyText(item.daysLeft)}
                    chipAccent
                  />
                ))
              ) : (
                <Empty>{t("today.empty.hearings")}</Empty>
              )}
            </Section>
          )}

          {summary.deadlines.visible && (
            <Section
              n="٢"
              title={`${t("today.panel.deadlines")} ${t("today.panel.deadlinesSub")}`}
              count={summary.deadlines.items.length}
              order={4}
            >
              {summary.deadlines.items.length ? (
                summary.deadlines.items.map((item: TodayDeadlineItem, i) => (
                  <Row
                    key={`${item.caseId}-${i}`}
                    href={`/cases/${item.caseId}`}
                    accent={urgencyAccent(item.daysLeft)}
                    label={
                      <>
                        {item.label}
                        <span className="sub"> — {item.caseTitle}</span>
                      </>
                    }
                    chip={urgencyText(item.daysLeft)}
                    chipAccent
                  />
                ))
              ) : (
                <Empty>{t("today.empty.deadlines")}</Empty>
              )}
            </Section>
          )}

          {summary.approvals.visible && (
          <Section
            n="٣"
            title={`${t("today.panel.approvals")} ${t("today.panel.approvalsSub")}`}
            count={summary.approvals.items.length}
            order={5}
          >
            {summary.approvals.items.length ? (
              summary.approvals.items.map((item) => {
                if (item.kind === "hrRequest") {
                  return (
                    <Row
                      key={item.id}
                      href="/hr/requests"
                      accent="var(--bench-600)"
                      label={
                        <>
                          {item.kindLabel}
                          <span className="sub"> — {item.employeeName}</span>
                          {item.department ? <span className="sub"> · {item.department}</span> : null}
                        </>
                      }
                      chip={item.statusLabel}
                    />
                  );
                }
                if (item.kind === "hearingReport") {
                  return (
                    <Row
                      key={item.id}
                      href={`/cases/${item.caseId}?tab=hearings#hearing-${item.id}`}
                      accent="var(--gold-600)"
                      label={
                        <>
                          {t("cases.hearings.sessionNo", { no: item.sessionNo.toLocaleString("ar-SA") })}
                          <span className="sub"> — {item.caseTitle}</span>
                        </>
                      }
                      chip={t("today.approvals.reportPending")}
                    />
                  );
                }
                return (
                  <Row
                    key={item.id}
                    href={`/cases/${item.caseId}?tab=approvals`}
                    accent="var(--gold-600)"
                    label={
                      <>
                        {item.title}
                        <span className="sub"> — {item.caseTitle}</span>
                      </>
                    }
                    chip={item.stageLabel}
                  />
                );
              })
            ) : (
              <Empty>{t("today.empty.approvals")}</Empty>
            )}
          </Section>
        )}

        {summary.tasks.visible && (
          <Section
            n="٤"
            title={`${t("today.panel.tasks")} ${t("today.panel.tasksSub")}`}
            count={summary.tasks.items.length}
            order={6}
          >
            {summary.tasks.items.length ? (
              summary.tasks.items.map((item) => (
                <Row
                  key={item.id}
                  href="/tasks"
                  accent={item.urgent ? "var(--adv-600)" : "var(--on-faint)"}
                  label={
                    <>
                      {item.title}
                      {item.caseTitle ? (
                        <span className="v2-chip is-soft" style={{ marginInlineStart: 8 }}>
                          <span className="ic">
                            <ScaleMark />
                          </span>
                          {item.caseTitle}
                        </span>
                      ) : null}
                    </>
                  }
                  chip={item.dueLabel ?? ""}
                />
              ))
            ) : (
              <Empty>{t("today.empty.tasks")}</Empty>
            )}
          </Section>
          )}
        </div>
      </div>
    </AppShell>
  );
}
