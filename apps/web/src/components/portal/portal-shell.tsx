"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@murafaa/i18n";
import {
  BrandMark,
  IconActivity,
  IconCases,
  IconClients,
  IconDashboard,
  IconDeadlines,
  IconDocuments,
  IconFinance,
  IconTasks,
  IconToday,
  IconUser,
} from "../icons";
import { PortalLogoutButton } from "./portal-forms";

const ICONS = {
  cases: IconCases,
  tasks: IconTasks,
  documents: IconDocuments,
  finance: IconFinance,
  chat: IconClients,
  today: IconToday,
  leaves: IconDeadlines,
  offices: IconClients,
  usage: IconDashboard,
  audit: IconActivity,
};

export type PortalNavItem = {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  count?: number;
};

/**
 * Shared frame for بوابة العميل and بوابة الموظف (design system PortalShell):
 * the office sidebar on desktop, a bottom bar instead of it at 980px and
 * below, and a topbar naming the office and the portal.
 */
export function PortalShell({
  kind,
  officeName,
  badge,
  userName,
  items,
  children,
}: {
  kind: "CLIENT" | "EMPLOYEE" | "PLATFORM";
  officeName: string;
  badge: string;
  userName: string;
  items: PortalNavItem[];
  children: React.ReactNode;
}) {
  const path = usePathname();
  // The home item matches only itself; the others also match their sub-pages.
  const home = items[0]?.href;
  const isOn = (href: string) =>
    href === home
      ? path === href ||
        (path.startsWith(`${href}/cases`) && kind === "CLIENT") ||
        (path.startsWith(`${href}/offices`) && kind === "PLATFORM")
      : path === href || path.startsWith(`${href}/`);
  const count = (n?: number) => (n ? n.toLocaleString("ar-SA") : null);
  // إدارة المنصة reads as a separate, darker layer (design system tone="platform").
  const tone = kind === "PLATFORM" ? " platform" : "";
  return (
    <div className="app-grid has-bottomnav">
      <aside className={`side${tone}`}>
        <div className="sbrand">
          <div className="s">
            <BrandMark />
          </div>
          <div>
            <h1>{t("app.name")}</h1>
            <p>{officeName}</p>
          </div>
        </div>
        <div className="navsec">{badge}</div>
        {items.map((i) => {
          const Icon = ICONS[i.icon];
          return (
            <Link key={i.href} href={i.href} className={`nav${isOn(i.href) ? " on" : ""}`}>
              <Icon />
              {i.label}
              {count(i.count) && <span className="cnt">{count(i.count)}</span>}
            </Link>
          );
        })}
        <div className="suser">
          <div className="u">
            <IconUser />
            <span>{userName}</span>
          </div>
          <PortalLogoutButton kind={kind} />
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <div className="topbrand">
            <span className="tb-mark">
              <span className="tb-ring">
                <BrandMark />
              </span>
              <span className="tb-word">{t("app.name")}</span>
            </span>
            <span className="tb-office">{officeName}</span>
            <span className={`portalbadge${tone}`}>{badge}</span>
          </div>
          <div className="spacer" />
          <span className="topuser">{userName}</span>
        </div>
        {children}
      </main>
      <nav className="bottomnav">
        {items.map((i) => {
          const Icon = ICONS[i.icon];
          return (
            <Link key={i.href} href={i.href} className={`bnav${isOn(i.href) ? " on" : ""}`}>
              <span className="bi">
                <Icon />
                {count(i.count) && <span className="bc">{count(i.count)}</span>}
              </span>
              {i.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
