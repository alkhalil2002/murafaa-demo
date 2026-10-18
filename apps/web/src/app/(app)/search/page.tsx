import Link from "next/link";
import { overviewSearch } from "@murafaa/sdk";
import { SEARCH_MIN_CHARS } from "@murafaa/contracts";
import { t, type MessageKey } from "@murafaa/i18n";
import { serverApi } from "@/lib/api";

type Hit = { id: string; label: string; sub: string | null; href: string };

const GROUPS = [
  ["cases", "search.group.cases"],
  ["clients", "search.group.clients"],
  ["leads", "search.group.leads"],
  ["documents", "search.group.documents"],
  ["invoices", "search.group.invoices"],
  ["tasks", "search.group.tasks"],
  ["employees", "search.group.employees"],
] as const satisfies ReadonlyArray<readonly [string, MessageKey]>;

function Group({ title, items }: { title: string; items: Hit[] }) {
  if (items.length === 0) return null;
  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <div className="clist">
        {items.map((r) => (
          <Link key={r.id} href={r.href} className="approve-row" style={{ cursor: "pointer" }}>
            <span className="at">
              {r.label}
              {r.sub ? <span className="sub"> · {r.sub}</span> : null}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Full search results (legacy search page), each category gated by its module. */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const query = ((await searchParams).q ?? "").trim();
  const api = await serverApi();
  const results =
    query.length >= SEARCH_MIN_CHARS
      ? ((await overviewSearch({ client: api, query: { q: query } })).data?.data ?? null)
      : null;
  const total = results ? GROUPS.reduce((n, [key]) => n + results[key].length, 0) : 0;
  return (
    <>
      <div className="vhead">
        <h2>{t("search.title")}</h2>
        <span className="pill">{query || "—"}</span>
      </div>
      {!results ? (
        <div className="panel">
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("search.tooShort")}
          </div>
        </div>
      ) : total === 0 ? (
        <div className="panel">
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("search.empty")}
          </div>
        </div>
      ) : (
        GROUPS.map(([key, label]) => <Group key={key} title={t(label)} items={results[key]} />)
      )}
    </>
  );
}
