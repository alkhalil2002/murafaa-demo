"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconBell } from "./icons";

/**
 * Frame chrome from the prototype: the 248px sidebar becomes an off-canvas
 * drawer under 980px, opened by the topbar's menu button. Sidebar and page
 * content are passed in from the server shell.
 */
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
  const router = useRouter();

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

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
          <form className="gsearch" onSubmit={submitSearch}>
            <input
              placeholder={searchPlaceholder}
              autoComplete="off"
              aria-label={searchLabel}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit">{searchLabel}</button>
          </form>
          <Link href="/notifications" className="bell" aria-label={bellLabel} style={{ position: "relative" }}>
            <IconBell />
            {bellCount > 0 ? (
              <span className="cnt" style={{ position: "absolute", top: -4, insetInlineEnd: -4 }}>
                {bellCount.toLocaleString("ar-SA")}
              </span>
            ) : null}
          </Link>
        </div>
        {children}
      </main>
    </div>
  );
}
