import { t } from "@murafaa/i18n";
import { authCurrent, securityGetIpAllowlist, securityStatus } from "@murafaa/sdk";
import { IpAllowlistPanel } from "@/components/settings/ip-allowlist-panel";
import { TotpPanel } from "@/components/settings/totp-panel";
import { serverApi } from "@/lib/api";

export default async function AccountSecurityPage() {
  const api = await serverApi();
  const [me, status] = await Promise.all([
    authCurrent({ client: api }),
    securityStatus({ client: api }),
  ]);
  const isPartner = me.data?.data.isPartner && !me.data.data.user.previewRole;
  const allowlist = isPartner
    ? (await securityGetIpAllowlist({ client: api })).data?.data.entries
    : undefined;

  return (
    <>
      <div className="vhead">
        <h2>{t("security.title")}</h2>
      </div>
      <TotpPanel enabled={Boolean(status.data?.data.totpEnabled)} />
      {allowlist && <IpAllowlistPanel entries={allowlist} />}
    </>
  );
}
