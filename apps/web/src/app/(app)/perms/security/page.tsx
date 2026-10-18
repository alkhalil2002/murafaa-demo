import Link from "next/link";
import { t } from "@murafaa/i18n";
import { authCurrent } from "@murafaa/sdk";
import { PermsDenied, PermsPage } from "@/components/perms/perms-page";
import { serverApi } from "@/lib/api";

export default async function PermsSecurityPage() {
  const me = (await authCurrent({ client: await serverApi() })).data?.data;
  // Partner-only, judged on the effective role like legacy: a previewing partner sees the denial.
  const allowed = me?.isPartner && !me.user.previewRole;
  return (
    <PermsPage>
      {!allowed ? (
        <PermsDenied />
      ) : (
        <div className="panel">
          <div className="sub" style={{ marginBottom: 12 }}>
            {t("perms.security.hint")}
          </div>
          <Link href="/account/security" className="act b-add">
            {t("perms.security.link")}
          </Link>
        </div>
      )}
    </PermsPage>
  );
}
