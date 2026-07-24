import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { getDeadlines, type DeadlineItem } from "@/server/deadlines";
import { PermissionError } from "@/lib/permissions/guard";
import type { Urgency } from "@/lib/dates";
import { t } from "@/lib/i18n";

const KIND_LABEL: Record<DeadlineItem["kind"], () => string> = {
  nextHearing: () => t("deadlines.nextHearing"),
  objection: () => t("deadlines.objection"),
  poa: () => t("deadlines.poa"),
  reminder: () => t("deadlines.reminder"),
};

const URGENCY_CLASS: Record<Urgency, string> = {
  overdue: "text-advocate",
  critical: "text-advocate",
  soon: "text-warn",
  upcoming: "text-gold",
  normal: "text-ink-soft",
};

function daysText(item: DeadlineItem): string {
  if (item.daysLeft < 0) return t("deadlines.overdue");
  if (item.daysLeft === 0) return t("deadlines.today");
  return t("deadlines.daysLeft", { n: item.daysLeft });
}

export default async function DeadlinesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const items = await getDeadlines(session);
    content =
      items.length === 0 ? (
        <p className="text-ink-soft">{t("deadlines.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li
              key={`${item.caseId}-${item.kind}-${i}`}
              className="flex items-center gap-4 rounded-xl border border-line bg-white p-3 text-sm"
            >
              <div className={`w-24 shrink-0 font-semibold ${URGENCY_CLASS[item.urgency]}`}>
                {daysText(item)}
              </div>
              <div className="flex-1">
                <div className="font-medium">
                  {KIND_LABEL[item.kind]()}
                  {item.label ? ` — ${item.label}` : ""}
                </div>
                <Link href={`/cases/${item.caseId}`} className="text-xs text-ink-soft hover:underline">
                  {item.caseTitle} · {item.date}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return (
    <AppShell>
      <h1 className="mb-6 font-serif text-3xl text-bench">{t("deadlines.title")}</h1>
      {content}
    </AppShell>
  );
}
