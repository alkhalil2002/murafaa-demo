import { redirect } from "next/navigation";
import { t } from "@murafaa/i18n";
import { PortalShell } from "@/components/portal/portal-shell";
import { clientPortalData } from "@/lib/portal-data";

/** بوابة العميل shell: the shared portal frame, no staff navigation at all. */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const data = await clientPortalData();
  if (!data) redirect("/portal/login");
  const pending = data.details
    .flatMap((d) => d.approvals)
    .filter((a) => a.status === "PENDING").length;
  return (
    <PortalShell
      kind="CLIENT"
      officeName={data.me.officeName}
      badge={t("portal.login.tagline")}
      userName={data.me.name}
      items={[
        { href: "/portal", label: t("portal.nav.cases"), icon: "cases" },
        {
          href: "/portal/approvals",
          label: t("portal.nav.approvals"),
          icon: "tasks",
          count: pending,
        },
        { href: "/portal/documents", label: t("portal.nav.documents"), icon: "documents" },
        { href: "/portal/invoices", label: t("portal.nav.invoices"), icon: "finance" },
        { href: "/portal/chat", label: t("portal.nav.chat"), icon: "chat" },
      ]}
    >
      {children}
    </PortalShell>
  );
}
