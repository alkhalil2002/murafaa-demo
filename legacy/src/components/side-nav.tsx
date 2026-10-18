"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
export function SideNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((s) => [s.id, Boolean(s.collapsed)])),
  );

  const toggle = (id: string) => setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <>
      {sections.map((section) => {
        const isCollapsed = Boolean(collapsed[section.id]);
        return (
          <div key={section.id}>
            <button
              type="button"
              className={`navsec${isCollapsed ? " collapsed" : ""}`}
              aria-expanded={!isCollapsed}
              onClick={() => toggle(section.id)}
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
