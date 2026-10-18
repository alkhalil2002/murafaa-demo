import Link from "next/link";
import { overviewActivity } from "@murafaa/sdk";
import { ACTIVITY_CATEGORIES, type ActivityCategory } from "@murafaa/rules";
import { formatWhen, t, type MessageKey } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import { serverApi } from "@/lib/api";

const CATEGORY_ICON: Record<ActivityCategory, string> = {
  case: "⚖",
  approval: "✔",
  client: "👤",
  finance: "🧾",
  whatsapp: "💬",
  hr: "🧑‍💼",
  other: "•",
};
const FILTERS = ACTIVITY_CATEGORIES.filter((c) => c !== "other");

/** سجل النشاط (legacy activity page): the audit log as a feed, by category and actor. */
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; actor?: string }>;
}) {
  const { type, actor } = await searchParams;
  const category = FILTERS.find((c) => c === type);
  const api = await serverApi();
  const feed = (
    await overviewActivity({
      client: api,
      query: { ...(category ? { type: category } : {}), ...(actor ? { actor } : {}) },
    })
  ).data?.data;

  const href = (next: { type?: string; actor?: string }) => {
    const p = new URLSearchParams();
    if (next.type) p.set("type", next.type);
    if (next.actor) p.set("actor", next.actor);
    const qs = p.toString();
    return qs ? `/activity?${qs}` : "/activity";
  };
  const total = feed ? Object.values(feed.counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <>
      <div className="vhead">
        <h2>{t("activity.title")}</h2>
        <span className="pill">{t("activity.subtitle")}</span>
      </div>
      {!feed ? (
        <DeniedPanel />
      ) : (
        <>
          <div className="panel" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="chips" style={{ flexWrap: "wrap" }}>
              <span className="sub" style={{ marginInlineEnd: 6 }}>
                {t("activity.filter.type")}:
              </span>
              <Link href={href({ actor })} className={`chip${!category ? " on" : ""}`}>
                {t("activity.filter.all")} ({total.toLocaleString("ar-SA")})
              </Link>
              {FILTERS.map((c) => (
                <Link
                  key={c}
                  href={href({ type: c, actor })}
                  className={`chip${category === c ? " on" : ""}`}
                >
                  {t(`activity.category.${c}` as MessageKey)} (
                  {(feed.counts[c] ?? 0).toLocaleString("ar-SA")})
                </Link>
              ))}
            </div>
            <div className="chips" style={{ flexWrap: "wrap" }}>
              <span className="sub" style={{ marginInlineEnd: 6 }}>
                {t("activity.filter.actor")}:
              </span>
              <Link href={href({ type: category })} className={`chip${!actor ? " on" : ""}`}>
                {t("activity.filter.all")}
              </Link>
              {feed.actors.map((u) => (
                <Link
                  key={u.id}
                  href={href({ type: category, actor: u.id })}
                  className={`chip${actor === u.id ? " on" : ""}`}
                >
                  {u.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="clist">
            {feed.rows.length === 0 ? (
              <div className="panel">
                <div className="sub" style={{ marginBottom: 0 }}>
                  {t("activity.empty")}
                </div>
              </div>
            ) : (
              feed.rows.map((r) => (
                <div key={r.id} className="dcard">
                  <span style={{ fontSize: 22.5 }}>{CATEGORY_ICON[r.category]}</span>
                  <div style={{ flex: 1 }}>
                    <div dir="ltr" style={{ textAlign: "start" }}>
                      {r.action}
                      {r.detail ? ` — ${r.detail}` : ""}
                    </div>
                    <div className="sub">
                      {t(`activity.category.${r.category}` as MessageKey)} · {r.actorName ?? "—"} ·{" "}
                      {formatWhen(r.at)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </>
  );
}
