"use client";

import { useState } from "react";
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
  children,
}: {
  sidebar: React.ReactNode;
  searchPlaceholder: string;
  searchLabel: string;
  menuLabel: string;
  bellLabel: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

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
          <div className="gsearch">
            <input placeholder={searchPlaceholder} autoComplete="off" aria-label={searchLabel} />
            <button type="button">{searchLabel}</button>
          </div>
          <button type="button" className="bell" aria-label={bellLabel}>
            <IconBell />
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}
