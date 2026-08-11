"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IconChevron } from "./icons";

export type NavItem = {
  href: string;
  label: string;
  /** Icon key resolved by the shell; kept serialisable across the RSC boundary. */
  icon: React.ReactNode;
  /** Optional badge count shown at the row's end (prototype `.cnt`). */
  count?: number;
};

export type NavSection = {
  id: string;
  title: string;
  items: NavItem[];
  /** Sections after the first two start collapsed, as in the prototype. */
  collapsed?: boolean;
};

/**
 * Sidebar navigation: collapsible sections with icon rows, reproducing the
 * prototype's `.navsec` / `.navgroup` / `.nav` chrome. Items are already
 * filtered by module access before they reach this component — the UI only
 * hides; every page still enforces server-side.
 */
const STORAGE_KEY = "murafaa.nav.sections";

export function SideNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();

  /**
   * Explicit user toggles only — `undefined` for a section the user has never
   * touched, so the route-derived default below still applies to it.
   *
   * This has to be persisted rather than held in plain state: `AppShell` is
   * rendered *inside each page* rather than as a route layout, so this
   * component unmounts and remounts on every navigation and any in-memory
   * state resets. Opening الإدارة and clicking المالية used to collapse the
   * very group you navigated from.
   */
  const [userToggled, setUserToggled] = useState<Record<string, boolean>>({});

  // Read after mount, never during render — localStorage doesn't exist on the
  // server and reading it in the initial state would cause a hydration mismatch.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setUserToggled(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      /* private mode / disabled storage — fall back to route-derived defaults */
    }
  }, []);

  const isActiveHref = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  /** A section holding the current route is open regardless of its default. */
  const holdsActiveRoute = (section: NavSection) => section.items.some((i) => isActiveHref(i.href));

  const toggle = (id: string, nowCollapsed: boolean) => {
    setUserToggled((prev) => {
      const next = { ...prev, [id]: nowCollapsed };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* not persisting is acceptable; the session still behaves correctly */
      }
      return next;
    });
  };

  return (
    <>
      {sections.map((section) => {
        // Precedence: explicit user choice → contains the active route → default.
        const explicit = userToggled[section.id];
        const isCollapsed =
          explicit !== undefined
            ? explicit
            : holdsActiveRoute(section)
              ? false
              : Boolean(section.collapsed);
        return (
          <div key={section.id}>
            <button
              type="button"
              className={`navsec${isCollapsed ? " collapsed" : ""}`}
              aria-expanded={!isCollapsed}
              onClick={() => toggle(section.id, !isCollapsed)}
            >
              <span>{section.title}</span>
              <IconChevron />
            </button>
            <div className={`navgroup${isCollapsed ? " collapsed" : ""}`}>
              <div className="ngrp-in">
                {section.items.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`nav${active ? " on" : ""}`}
                      aria-current={active ? "page" : undefined}
                      tabIndex={isCollapsed ? -1 : undefined}
                    >
                      {item.icon}
                      {item.label}
                      {typeof item.count === "number" && item.count > 0 ? (
                        <span className="cnt">{item.count.toLocaleString("ar-SA")}</span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
