import Link from "next/link";
import { redirect } from "next/navigation";
import { clientPortalMe } from "@murafaa/sdk";
import { t } from "@murafaa/i18n";
import { PortalLogoutButton } from "@/components/portal/portal-forms";
import { serverApi } from "@/lib/api";

/** بوابة العميل shell (legacy portal layout): no staff navigation at all. */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const me = (await clientPortalMe({ client: await serverApi() })).data?.data;
  if (!me) redirect("/portal/login");
  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "var(--parch)" }}>
      <div className="topbar" style={{ maxWidth: 900, margin: "0 auto", padding: "16px 16px 0" }}>
        <Link href="/portal" className="pill">
          {me.officeName} — {t("portal.login.tagline")}
        </Link>
        <Link href="/portal" className="chip">
          {t("portal.nav.cases")}
        </Link>
        <Link href="/portal/invoices" className="chip">
          {t("portal.nav.invoices")}
        </Link>
        <span className="chip" style={{ marginInlineStart: "auto" }}>
          {me.name}
        </span>
        <PortalLogoutButton kind="CLIENT" />
      </div>
      <main style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>{children}</main>
    </div>
  );
}
