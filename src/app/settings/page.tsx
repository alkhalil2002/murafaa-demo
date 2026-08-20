import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { signOut } from "@/lib/auth";
import { listRecycleBin } from "@/server/settings";
import { getOfficeBranding, resolveLogoDataUri, resolveFooterImageDataUri } from "@/server/office-settings";
import { effectiveRole } from "@/lib/permissions/engine";
import {
  restoreRecycleItemAction,
  purgeRecycleBinAction,
  updateOfficeBrandingAction,
  uploadOfficeLogoAction,
  removeOfficeLogoAction,
  uploadOfficeFooterImageAction,
  removeOfficeFooterImageAction,
} from "./actions";
import { RIYADH_TZ } from "@/lib/dates";
import { t, type MessageKey } from "@/lib/i18n";

function formatWhen(d: Date): string {
  return new Intl.DateTimeFormat("ar-SA", { timeZone: RIYADH_TZ, dateStyle: "medium" }).format(d);
}

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [items, branding] = await Promise.all([listRecycleBin(session), getOfficeBranding(session)]);
  const isPartner = effectiveRole(session) === "PARTNER";
  const [logoDataUri, footerImageDataUri] = await Promise.all([
    resolveLogoDataUri(branding),
    resolveFooterImageDataUri(branding),
  ]);

  return (
    <AppShell>
      <div className="vhead">
        <h2>{t("settings.title")}</h2>
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("settings.office.title")}</h2>
        <div className="sub" style={{ marginBottom: 12 }}>{t("settings.office.hint")}</div>
        {!isPartner ? (
          <div className="sub" style={{ marginBottom: 0 }}>{t("settings.office.deniedNote")}</div>
        ) : (
          <form action={updateOfficeBrandingAction} style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <label className="field" style={{ flex: 1, minWidth: 220 }}>
              <span>{t("settings.office.name")}</span>
              <input type="text" name="name" defaultValue={branding.name} required />
            </label>
            <label className="field" style={{ flex: 1, minWidth: 220 }}>
              <span>{t("settings.office.tagline")}</span>
              <input type="text" name="tagline" defaultValue={branding.tagline} />
            </label>
            <label className="field" style={{ minWidth: 180 }}>
              <span>{t("settings.office.phone")}</span>
              <input type="text" name="phone" dir="ltr" defaultValue={branding.phone} />
            </label>
            <label className="field" style={{ minWidth: 220 }}>
              <span>{t("settings.office.email")}</span>
              <input type="text" name="email" dir="ltr" defaultValue={branding.email} />
            </label>
            <label className="field" style={{ minWidth: 180 }}>
              <span>{t("settings.office.website")}</span>
              <input type="text" name="website" dir="ltr" defaultValue={branding.website} />
            </label>
            <label className="field" style={{ flex: 1, minWidth: 220 }}>
              <span>{t("settings.office.address")}</span>
              <input type="text" name="address" defaultValue={branding.address} />
            </label>
            <label className="field" style={{ minWidth: 200 }}>
              <span>{t("settings.office.licenseNo")}</span>
              <input type="text" name="licenseNo" defaultValue={branding.licenseNo} />
            </label>
            <label className="field" style={{ minWidth: 140 }}>
              <span>{t("settings.office.primaryColor")}</span>
              <input type="color" name="primaryColor" defaultValue={branding.primaryColor} />
            </label>
            <label className="field" style={{ minWidth: 140 }}>
              <span>{t("settings.office.accentColor")}</span>
              <input type="color" name="accentColor" defaultValue={branding.accentColor} />
            </label>
            <label className="field" style={{ flex: 1, minWidth: 260 }}>
              <span>{t("settings.office.confidentialityNotice")}</span>
              <input type="text" name="confidentialityNotice" defaultValue={branding.confidentialityNotice} />
            </label>
            <div style={{ width: "100%" }}>
              <button type="submit" className="act b-add">{t("settings.office.save")}</button>
            </div>
          </form>
        )}
        {isPartner && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
            <div className="sub" style={{ fontWeight: 600, marginBottom: 8 }}>{t("settings.office.logo")}</div>
            <div className="sub" style={{ marginBottom: 10 }}>{t("settings.office.logoHint")}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              {logoDataUri && (
                // eslint-disable-next-line @next/next/no-img-element -- data: URI preview, next/image can't optimize it anyway
                <img
                  src={logoDataUri}
                  alt=""
                  style={{ maxHeight: 60, maxWidth: 160, objectFit: "contain", border: "1px solid var(--line)", borderRadius: 8, padding: 6, background: "#fff" }}
                />
              )}
              <form action={uploadOfficeLogoAction} encType="multipart/form-data" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="file" name="file" accept="image/png,image/jpeg,image/webp" required />
                <button type="submit" className="act b-add">{t("settings.office.logoUpload")}</button>
              </form>
              {logoDataUri && (
                <form action={removeOfficeLogoAction}>
                  <button type="submit" className="tinybtn del">{t("settings.office.logoRemove")}</button>
                </form>
              )}
            </div>
          </div>
        )}
        {isPartner && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
            <div className="sub" style={{ fontWeight: 600, marginBottom: 8 }}>{t("settings.office.footerImage")}</div>
            <div className="sub" style={{ marginBottom: 10 }}>{t("settings.office.footerImageHint")}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              {footerImageDataUri && (
                // eslint-disable-next-line @next/next/no-img-element -- data: URI preview, next/image can't optimize it anyway
                <img
                  src={footerImageDataUri}
                  alt=""
                  style={{ maxHeight: 60, maxWidth: 320, objectFit: "contain", border: "1px solid var(--line)", borderRadius: 8, padding: 6, background: "#fff" }}
                />
              )}
              <form action={uploadOfficeFooterImageAction} encType="multipart/form-data" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="file" name="file" accept="image/png,image/jpeg,image/webp" required />
                <button type="submit" className="act b-add">{t("settings.office.footerImageUpload")}</button>
              </form>
              {footerImageDataUri && (
                <form action={removeOfficeFooterImageAction}>
                  <button type="submit" className="tinybtn del">{t("settings.office.footerImageRemove")}</button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="vhead" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{t("settings.recycle.title")}</h2>
          {items.length > 0 && (
            <form action={purgeRecycleBinAction}>
              <button type="submit" className="tinybtn del">
                {t("settings.recycle.purge")}
              </button>
            </form>
          )}
        </div>
        <div className="sub" style={{ marginBottom: 12 }}>{t("settings.recycle.hint")}</div>
        {items.length === 0 ? (
          <div className="sub" style={{ marginBottom: 0 }}>{t("settings.recycle.empty")}</div>
        ) : (
          <div className="clist">
            {items.map((item) => (
              <div key={`${item.kind}:${item.id}`} className="approve-row">
                <span className="chip">{t(`settings.recycle.kind.${item.kind}` as MessageKey)}</span>
                <span className="at">{item.label}</span>
                <span className="sub" style={{ marginInlineEnd: 8 }}>{formatWhen(item.deletedAt)}</span>
                <form action={restoreRecycleItemAction}>
                  <input type="hidden" name="kind" value={item.kind} />
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit" className="tinybtn">
                    {t("settings.recycle.restore")}
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("settings.account.title")}</h2>
        <div className="field">
          <label>{t("settings.account.phone")}</label>
          <input type="text" readOnly dir="ltr" value={session.phone} />
        </div>
        <div className="field">
          <label>{t("settings.account.hosting")}</label>
          <div className="sub">{t("settings.account.hostingValue")}</div>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" className="tinybtn del">
            {t("settings.account.logout")}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
