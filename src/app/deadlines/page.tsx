import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { getDeadlines, type DeadlineItem } from "@/server/deadlines";
import { PermissionError } from "@/lib/permissions/guard";
import type { Urgency } from "@/lib/dates";
import { t } from "@/lib/i18n";
import { formatDateAr } from "@/lib/dates";

const KIND_LABEL: Record<DeadlineItem["kind"], () => string> = {
  nextHearing: () => t("deadlines.nextHearing"),
  objection: () => t("deadlines.objection"),
  poa: () => t("deadlines.poa"),
  reminder: () => t("deadlines.reminder"),
};

function daysText(item: DeadlineItem): string {
  if (item.daysLeft < 0) return t("deadlines.overdue");
  if (item.daysLeft === 0) return t("deadlines.today");
  return t("deadlines.daysLeft", { n: item.daysLeft });
}

const URGENCY_COLOR: Record<Urgency, string> = {
  overdue: "var(--advocate)",
  critical: "var(--advocate)",
  soon: "var(--gold)",
  upcoming: "var(--ok)",
  normal: "var(--ink-soft)",
};

export default async function DeadlinesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  let total = 0;
  try {
    const items = await getDeadlines(session);
    total = items.length;
    content = (
      <div className="panel">
        {items.length === 0 ? (
          <div className="sub" style={{ fontSize: 16.25, color: "var(--ink-soft)" }}>
            {t("deadlines.empty")}
          </div>
        ) : (
          items.map((item, i) => {
            const color = URGENCY_COLOR[item.urgency];
            return (
              <Link
                href={`/cases/${item.caseId}`}
                className="approve-row"
                style={{ cursor: "pointer" }}
                key={`${item.caseId}-${item.kind}-${i}`}
              >
                <span className="ndot" style={{ background: color }} />
                <span className="at">
                  {KIND_LABEL[item.kind]()}
                  {item.label ? ` — ${item.label}` : ""} — {item.caseTitle}
                  <span style={{ color: "var(--ink-soft)", fontSize: 15 }}> ({formatDateAr(item.date)})</span>
                </span>
                <span className="chip" style={{ color, borderColor: color }}>
                  {daysText(item)}
                </span>
              </Link>
            );
          })
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
        <h2>{t("deadlines.title")}</h2>
        <span className="pill">{t("deadlines.pill", { n: total.toLocaleString("ar-SA") })}</span>
      </div>
      {content}
    </AppShell>
  );
}
