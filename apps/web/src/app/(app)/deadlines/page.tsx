import Link from "next/link";
import { overviewListDeadlines } from "@murafaa/sdk";
import { t, type MessageKey } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import { serverApi } from "@/lib/api";

const URGENCY_COLOR: Record<string, string> = {
  overdue: "var(--advocate)",
  critical: "var(--advocate)",
  soon: "var(--amber-600)",
  upcoming: "var(--ok)",
  normal: "var(--ink-soft)",
};

function daysText(daysLeft: number): string {
  if (daysLeft < 0) return t("deadlines.overdue");
  if (daysLeft === 0) return t("deadlines.today");
  return t("deadlines.daysLeft", { n: daysLeft.toLocaleString("ar-SA") });
}

/** المواعيد والمهل (legacy deadlines page): case-derived dates, soonest first. */
export default async function DeadlinesPage() {
  const api = await serverApi();
  const items = (await overviewListDeadlines({ client: api })).data?.data;
  return (
    <>
      <div className="vhead">
        <h2>{t("deadlines.title")}</h2>
        <span className="pill">
          {t("deadlines.pill", { n: (items?.length ?? 0).toLocaleString("ar-SA") })}
        </span>
      </div>
      {!items ? (
        <DeniedPanel />
      ) : (
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
                    {t(`deadlines.${item.kind}` as MessageKey)}
                    {item.label ? ` — ${item.label}` : ""} — {item.caseTitle}
                    <span style={{ color: "var(--ink-soft)", fontSize: 15 }}> ({item.date})</span>
                  </span>
                  <span className="chip" style={{ color, borderColor: color }}>
                    {daysText(item.daysLeft)}
                  </span>
                </Link>
              );
            })
          )}
        </div>
      )}
    </>
  );
}
