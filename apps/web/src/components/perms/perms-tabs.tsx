"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@murafaa/i18n";

const TABS = [
  { href: "/perms", label: "perms.tab.roles" },
  { href: "/perms/users", label: "perms.tab.users" },
  { href: "/perms/audit", label: "perms.tab.audit" },
  { href: "/perms/security", label: "perms.tab.security" },
] as const;

export function PermsTabs() {
  const pathname = usePathname();
  return (
    <div className="ftabs">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`ftab${pathname === tab.href ? " on" : ""}`}
        >
          {t(tab.label)}
        </Link>
      ))}
    </div>
  );
}
