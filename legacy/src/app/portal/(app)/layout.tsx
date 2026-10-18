import { redirect } from "next/navigation";
import Link from "next/link";
import { getPortalSession } from "@/lib/auth/portal-session";
import { portalLogoutAction } from "../actions";
import { t } from "@/lib/i18n";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "var(--parch)" }}>
      <div className="topbar" style={{ maxWidth: 900, margin: "0 auto", padding: "16px 16px 0" }}>
        <Link href="/portal" className="pill">
          {t("app.name")} — {t("portal.login.tagline")}
        </Link>
        <Link href="/portal" className="chip">
          {t("portal.nav.cases")}
        </Link>
        <Link href="/portal/invoices" className="chip">
          {t("portal.nav.invoices")}
        </Link>
        <span className="chip" style={{ marginInlineStart: "auto" }}>
          {session.name}
        </span>
        <form action={portalLogoutAction}>
          <button type="submit" className="mini">
            {t("auth.signout")}
          </button>
        </form>
      </div>
      <main style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>{children}</main>
    </div>
  );
}
