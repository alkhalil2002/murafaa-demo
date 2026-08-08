import { redirect } from "next/navigation";
import Link from "next/link";
import { Role } from "@prisma/client";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { PermsTabs } from "@/components/perms-tabs";
import { getSession } from "@/lib/auth/session";
import { effectiveRole } from "@/lib/permissions/engine";
import { t } from "@/lib/i18n";

export default async function PermsSecurityPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <AppShell>
      <div className="vhead">
        <h2>{t("perms.title")}</h2>
        <span className="pill">{t("perms.pill")}</span>
      </div>
      <PermsTabs />
      {effectiveRole(session) !== Role.PARTNER ? (
        <DeniedPanel />
      ) : (
        <div className="panel">
          <div className="sub" style={{ marginBottom: 12 }}>{t("perms.security.hint")}</div>
          <Link href="/account/security" className="act b-add">
            {t("perms.security.link")}
          </Link>
        </div>
      )}
    </AppShell>
  );
}
