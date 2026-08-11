"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconBell } from "./icons";
import { t, type MessageKey } from "@/lib/i18n";
import type { SearchResults } from "@/server/search";

/**
 * Frame chrome from the prototype: the 248px sidebar becomes an off-canvas
 * drawer under 980px, opened by the topbar's menu button. Sidebar and page
 * content are passed in from the server shell.
 */

const GROUPS: Array<[keyof SearchResults, MessageKey]> = [
  ["cases", "search.group.cases"],
  ["clients", "search.group.clients"],
  ["leads", "search.group.leads"],
  ["documents", "search.group.documents"],
  ["invoices", "search.group.invoices"],
  ["tasks", "search.group.tasks"],
  ["employees", "search.group.employees"],
];

export function ShellFrame({
  sidebar,
  searchPlaceholder,
  searchLabel,
  menuLabel,
  bellLabel,
  bellCount = 0,
  children,
}: {
  sidebar: React.ReactNode;
  searchPlaceholder: string;
  searchLabel: string;
  menuLabel: string;
  bellLabel: string;
  bellCount?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((body) => setResults(body.data ?? null))
        .catch(() => setResults(null));
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setDropdownOpen(false);
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  const totalResults = results ? GROUPS.reduce((s, [key]) => s + results[key].length, 0) : 0;

  return (
    <div className="app-grid">
      <aside className={`side${open ? " open" : ""}`}>{sidebar}</aside>
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      ) : null}
      <main className="main">
        <div className="topbar">
          <button
            type="button"
            className="menubtn"
            aria-label={menuLabel}
            onClick={() => setOpen((v) => !v)}
          >
            ☰
          </button>
          <form className="gsearch" onSubmit={submitSearch} style={{ position: "relative" }}>
            <input
              placeholder={searchPlaceholder}
              autoComplete="off"
              aria-label={searchLabel}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setDropdownOpen(true)}
              onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
            />
            <button type="submit">{searchLabel}</button>
            {dropdownOpen && query.trim().length >= 2 && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  insetInlineStart: 0,
                  insetInlineEnd: 0,
                  background: "var(--parch, #fff)",
                  border: "1px solid var(--line, #ddd)",
                  borderRadius: 12,
                  boxShadow: "0 8px 24px rgba(0,0,0,.12)",
                  zIndex: 50,
                  maxHeight: 420,
                  overflowY: "auto",
                  padding: 8,
                }}
              >
                {!results ? (
                  <div className="sub" style={{ padding: 8 }}>
                    …
                  </div>
                ) : totalResults === 0 ? (
                  <div className="sub" style={{ padding: 8 }}>
                    {t("search.empty")}
                  </div>
                ) : (
                  GROUPS.map(([key, labelKey]) => {
                    const items = results[key];
                    if (items.length === 0) return null;
                    return (
                      <div key={key} style={{ marginBottom: 6 }}>
                        <div className="sub" style={{ fontWeight: 600, fontSize: 14.375, padding: "2px 8px" }}>
                          {t(labelKey)}
                        </div>
                        {items.map((r) => (
                          <Link
                            key={r.id}
                            href={r.href}
                            className="approve-row"
                            style={{ padding: "6px 8px", cursor: "pointer" }}
                            onClick={() => setDropdownOpen(false)}
                          >
                            <span className="at">
                              {r.label}
                              {r.sub ? <span className="sub"> · {r.sub}</span> : null}
                            </span>
                          </Link>
                        ))}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </form>
          {/* Badge class is `nb`, matching the `.bell .nb` rule in globals.css.
              It previously rendered as `cnt` — a class only defined under
              `.nav` — so the count came out unstyled (no pill, no background)
              and sat outside the bell's edge. `.bell` is already
              position:relative and `.bell .nb` handles the offset, so no
              inline positioning is needed here. */}
          <Link href="/notifications" className="bell" aria-label={bellLabel}>
            <IconBell />
            {bellCount > 0 ? (
              <span className="nb">{bellCount.toLocaleString("ar-SA")}</span>
            ) : null}
          </Link>
        </div>
        {children}
      </main>
    </div>
  );
}
