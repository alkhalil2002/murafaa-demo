import { redirect } from "next/navigation";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { listActivity, listActivityActors, countActivityByCategory, type ActivityCategory } from "@/server/activity";
import { PermissionError } from "@/lib/permissions/guard";
import { t, type MessageKey } from "@/lib/i18n";
import { RIYADH_TZ } from "@/lib/dates";

const CATEGORY_ICON: Record<ActivityCategory, string> = {
  case: "⚖",
  approval: "✔",
  client: "👤",
  finance: "🧾",
  whatsapp: "💬",
  hr: "🧑‍💼",
  other: "•",
};

const CATEGORIES: ActivityCategory[] = ["case", "approval", "client", "finance", "whatsapp", "hr"];

function formatWhen(d: Date): string {
  return new Intl.DateTimeFormat("ar-SA", {
    timeZone: RIYADH_TZ,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; actor?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { type, actor } = await searchParams;
  const category = CATEGORIES.includes(type as ActivityCategory) ? (type as ActivityCategory) : undefined;

  let content: React.ReactNode;
  try {
    const [rows, actors, counts] = await Promise.all([
      listActivity(session, { category, actorId: actor || undefined }),
      listActivityActors(session),
      countActivityByCategory(session),
    ]);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    const typeHref = (v?: ActivityCategory) => {
      const p = new URLSearchParams();
      if (v) p.set("type", v);
      if (actor) p.set("actor", actor);
      const qs = p.toString();
      return qs ? `/activity?${qs}` : "/activity";
    };
    const actorHref = (v?: string) => {
      const p = new URLSearchParams();
      if (category) p.set("type", category);
      if (v) p.set("actor", v);
      const qs = p.toString();
      return qs ? `/activity?${qs}` : "/activity";
    };

    content = (
      <>
        <div className="panel" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="chips" style={{ flexWrap: "wrap" }}>
            <span className="sub" style={{ marginInlineEnd: 6 }}>{t("activity.filter.type")}:</span>
            <a href={typeHref(undefined)} className={`chip${!category ? " on" : ""}`}>
              {t("activity.filter.all")} ({total.toLocaleString("ar-SA")})
            </a>
            {CATEGORIES.map((c) => (
              <a key={c} href={typeHref(c)} className={`chip${category === c ? " on" : ""}`}>
                {t(`activity.category.${c}` as MessageKey)} ({(counts[c] ?? 0).toLocaleString("ar-SA")})
              </a>
            ))}
          </div>
          <div className="chips" style={{ flexWrap: "wrap" }}>
            <span className="sub" style={{ marginInlineEnd: 6 }}>{t("activity.filter.actor")}:</span>
            <a href={actorHref(undefined)} className={`chip${!actor ? " on" : ""}`}>
              {t("activity.filter.all")}
            </a>
            {actors.map((u) => (
              <a key={u.id} href={actorHref(u.id)} className={`chip${actor === u.id ? " on" : ""}`}>
                {u.name}
              </a>
            ))}
          </div>
        </div>

        <div className="clist">
          {rows.length === 0 ? (
            <div className="panel">
              <div className="sub" style={{ marginBottom: 0 }}>{t("activity.empty")}</div>
            </div>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="dcard">
                <span style={{ fontSize: 22.5 }}>{CATEGORY_ICON[r.category]}</span>
                <div style={{ flex: 1 }}>
                  <div>{r.action}{r.detail ? ` — ${r.detail}` : ""}</div>
                  <div className="sub">
                    {t(`activity.category.${r.category}` as MessageKey)} · {r.actorName ?? "—"} · {formatWhen(r.createdAt)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </>
    );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return (
    <AppShell>
      <div className="vhead">
        <h2>{t("activity.title")}</h2>
        <span className="pill">{t("activity.subtitle")}</span>
      </div>
      {content}
    </AppShell>
  );
}
