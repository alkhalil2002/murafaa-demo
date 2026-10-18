import { formatWhen, t, type MessageKey } from "@murafaa/i18n";
import {
  authCurrent,
  integrationsList,
  officesBranding,
  officesTaxProfile,
  recycleList,
} from "@murafaa/sdk";
import { BrandingForm } from "@/components/settings/branding-form";
import { IntegrationList } from "@/components/settings/integration-list";
import { TaxProfileForm } from "@/components/settings/tax-profile-form";
import { RestoreButton } from "@/components/settings/restore-button";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { serverApi } from "@/lib/api";

export default async function SettingsPage() {
  const api = await serverApi();
  const [me, branding, recycle, tax, integrations] = await Promise.all([
    authCurrent({ client: api }),
    officesBranding({ client: api }),
    recycleList({ client: api }),
    officesTaxProfile({ client: api }),
    integrationsList({ client: api }),
  ]);
  const isPartner = me.data?.data.isPartner && !me.data.data.user.previewRole;
  const items = recycle.data?.data ?? [];

  return (
    <>
      <div className="vhead">
        <h2>{t("settings.title")}</h2>
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("settings.office.title")}</h2>
        <div className="sub" style={{ marginBottom: 12 }}>
          {t("settings.office.hint")}
        </div>
        {isPartner && branding.data ? (
          <BrandingForm branding={branding.data.data} />
        ) : (
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("settings.office.deniedNote")}
          </div>
        )}
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("settings.tax.title")}</h2>
        <div className="sub" style={{ marginBottom: 12 }}>
          {t("settings.tax.hint")}
        </div>
        {isPartner && tax.data ? (
          <TaxProfileForm profile={tax.data.data} />
        ) : (
          <div className="sub" style={{ marginBottom: 0 }}>
            {tax.data?.data.vatNumber ?? t("settings.tax.partnerOnly")}
          </div>
        )}
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("integration.title")}</h2>
        <div className="sub" style={{ marginBottom: 12 }}>
          {t("integration.hint")}
        </div>
        <IntegrationList rows={integrations.data?.data ?? []} />
      </div>

      <div className="panel">
        <div className="vhead" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{t("settings.recycle.title")}</h2>
        </div>
        <div className="sub" style={{ marginBottom: 12 }}>
          {t("settings.recycle.hint")}
        </div>
        {items.length === 0 ? (
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("settings.recycle.empty")}
          </div>
        ) : (
          <div className="clist">
            {items.map((item) => (
              <div key={`${item.kind}:${item.id}`} className="approve-row">
                <span className="chip">
                  {t(`settings.recycle.kind.${item.kind}` as MessageKey)}
                </span>
                <span className="at">{item.label}</span>
                <span className="sub" style={{ marginInlineEnd: 8 }}>
                  {formatWhen(item.deletedAt)}
                </span>
                <RestoreButton kind={item.kind} id={item.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("settings.account.title")}</h2>
        <div className="field">
          <label>{t("settings.account.phone")}</label>
          <input type="text" readOnly dir="ltr" value={me.data?.data.phone ?? ""} />
        </div>
        <div className="field">
          <label>{t("settings.account.hosting")}</label>
          <div className="sub">{t("settings.account.hostingValue")}</div>
        </div>
        <SignOutButton label={t("settings.account.logout")} className="tinybtn del" />
      </div>
    </>
  );
}
