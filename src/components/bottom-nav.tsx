"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "./side-nav";

/**
 * Mobile bottom navigation.
 *
 * Replaces the off-canvas drawer as the PRIMARY navigation under 980px: a
 * drawer hides every destination behind a tap, which is the wrong default on a
 * phone. Five destinations plus "المزيد", which opens the existing drawer for
 * everything else — the drawer stays, it just stops being the only way in.
 *
 * Items arrive already filtered by module permission, so a role that cannot see
 * القضايا never gets it in the bar. PRIORITY lists the destinations worth a
 * permanent slot, in order; whatever the role can actually reach fills the five
 * slots from that list, then anything else it can reach backfills.
 */

/** Bottom-bar order. Five slots; the sixth is always "more". */
const PRIORITY = ["/today", "/cases", "/tasks", "/deadlines", "/clients", "/documents"];

const SLOTS = 5;

export function BottomNav({
  items,
  moreLabel,
  onMore,
}: {
  items: NavItem[];
  moreLabel: string;
  onMore: () => void;
}) {
  const pathname = usePathname();

  const byHref = new Map(items.map((i) => [i.href, i]));
  const ranked = [
    ...PRIORITY.map((h) => byHref.get(h)).filter((i): i is NavItem => Boolean(i)),
    ...items.filter((i) => !PRIORITY.includes(i.href)),
  ];
  const shown = ranked.slice(0, SLOTS);

  return (
    <nav className="bottomnav" aria-label={moreLabel}>
      {shown.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`bn-item${active ? " on" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="bn-icon">{item.icon}</span>
            <span className="bn-label">{item.label}</span>
          </Link>
        );
      })}
      <button type="button" className="bn-item" onClick={onMore} aria-haspopup="menu">
        <span className="bn-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <circle cx="5" cy="12" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="19" cy="12" r="1.8" />
          </svg>
        </span>
        <span className="bn-label">{moreLabel}</span>
      </button>
    </nav>
  );
}
