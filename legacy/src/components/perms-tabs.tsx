"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@/lib/i18n";

export function PermsTabs() {
  const pathname = usePathname();
  const tabs = [
    { href: "/perms", label: t("perms.tab.roles") },
    { href: "/perms/users", label: t("perms.tab.users") },
    { href: "/perms/audit", label: t("perms.tab.audit") },
    { href: "/perms/security", label: t("perms.tab.security") },
  ];
  return (
    <div className="ftabs">
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} className={`ftab${pathname === tab.href ? " on" : ""}`}>
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
