import { redirect } from "next/navigation";
import { platformMe } from "@murafaa/sdk";
import { t } from "@murafaa/i18n";
import { PortalShell } from "@/components/portal/portal-shell";
import { serverApi } from "@/lib/api";

/** إدارة المنصة: the shared portal frame in its darker platform tone. */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const me = (await platformMe({ client: await serverApi() })).data?.data;
  if (!me) redirect("/platform/login");
  return (
    <PortalShell
      kind="PLATFORM"
      officeName={t("platform.team")}
      badge={t("platform.badge")}
      userName={me.name}
      items={[
        { href: "/platform", label: t("platform.nav.offices"), icon: "offices" },
        {
          href: "/platform/subscriptions",
          label: t("platform.nav.subscriptions"),
          icon: "finance",
        },
        { href: "/platform/usage", label: t("platform.nav.usage"), icon: "usage" },
        { href: "/platform/audit", label: t("platform.nav.audit"), icon: "audit" },
      ]}
    >
      {children}
    </PortalShell>
  );
}
