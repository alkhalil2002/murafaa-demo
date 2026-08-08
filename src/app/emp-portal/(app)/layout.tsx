import { redirect } from "next/navigation";
import Link from "next/link";
import { getEmpPortalSession } from "@/lib/auth/emp-portal-session";
import { empPortalLogoutAction } from "../actions";
import { t } from "@/lib/i18n";

export default async function EmpPortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getEmpPortalSession();
  if (!session) redirect("/emp-portal/login");

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "var(--parch)" }}>
      <div className="topbar" style={{ maxWidth: 900, margin: "0 auto", padding: "16px 16px 0" }}>
        <Link href="/emp-portal" className="pill">
          {t("app.name")} — {t("empPortal.login.tagline")}
        </Link>
        <span className="chip" style={{ marginInlineStart: "auto" }}>
          {session.name}
        </span>
        <form action={empPortalLogoutAction}>
          <button type="submit" className="mini">
            {t("auth.signout")}
          </button>
        </form>
      </div>
      <main style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>{children}</main>
    </div>
  );
}
