import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { globalSearch, type SearchResult } from "@/server/search";
import { t, type MessageKey } from "@/lib/i18n";

function Group({ title, items }: { title: string; items: SearchResult[] }) {
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

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const results = query.length >= 2 ? await globalSearch(session, query) : null;
  const total = results
    ? results.cases.length +
      results.clients.length +
      results.leads.length +
      results.documents.length +
      results.invoices.length +
      results.tasks.length +
      results.employees.length
    : 0;

  const groups: Array<[MessageKey, SearchResult[]]> = results
    ? [
        ["search.group.cases", results.cases],
        ["search.group.clients", results.clients],
        ["search.group.leads", results.leads],
        ["search.group.documents", results.documents],
        ["search.group.invoices", results.invoices],
        ["search.group.tasks", results.tasks],
        ["search.group.employees", results.employees],
      ]
    : [];

  return (
    <AppShell>
      <div className="vhead">
        <h2>{t("search.title")}</h2>
        <span className="pill">{query || "—"}</span>
      </div>

      {!results ? (
        <div className="panel">
          <div className="sub" style={{ marginBottom: 0 }}>{t("search.tooShort")}</div>
        </div>
      ) : total === 0 ? (
        <div className="panel">
          <div className="sub" style={{ marginBottom: 0 }}>{t("search.empty")}</div>
        </div>
      ) : (
        groups.map(([key, items]) => <Group key={key} title={t(key)} items={items} />)
      )}
    </AppShell>
  );
}
