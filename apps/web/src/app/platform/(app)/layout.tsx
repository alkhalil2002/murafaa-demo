import { redirect } from "next/navigation";
import { t, type MessageKey } from "@murafaa/i18n";
import { PortalShell } from "@/components/portal/portal-shell";
import { platformMeData } from "@/lib/portal-data";

/** إدارة المنصة: the shared portal frame in its darker platform tone. */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const me = await platformMeData();
  if (!me) redirect("/platform/login");
  return (
    <PortalShell
      kind="PLATFORM"
      officeName={t("platform.team")}
      badge={t("platform.badge")}
      userName={`${me.name} · ${t(`platform.role.${me.role}` as MessageKey)}`}
      items={[
        { href: "/platform", label: t("platform.nav.offices"), icon: "offices" },
        {
          href: "/platform/subscriptions",
          label: t("platform.nav.subscriptions"),
          icon: "finance",
        },
        { href: "/platform/usage", label: t("platform.nav.usage"), icon: "usage" },
        { href: "/platform/audit", label: t("platform.nav.audit"), icon: "audit" },
        ...(me.actions.includes("team.manage")
          ? [{ href: "/platform/team", label: t("platform.nav.team"), icon: "team" as const }]
          : []),
      ]}
    >
      {children}
    </PortalShell>
  );
}
