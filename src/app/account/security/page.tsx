import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { getSecurityStatus, beginTotpEnroll, getOfficeIpAllowlist } from "@/server/security";
import { confirmTotpEnrollAction, disableTotpAction, setOfficeIpAllowlistAction } from "../actions";
import { effectiveRole } from "@/lib/permissions/engine";
import { t } from "@/lib/i18n";

export default async function AccountSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { err } = await searchParams;

  const status = await getSecurityStatus(session);
  const enrollment = status.totpEnabled ? null : await beginTotpEnroll(session);
  const ipAllowlist = effectiveRole(session) === "PARTNER" ? await getOfficeIpAllowlist(session) : null;

  return (
    <AppShell>
      <div className="vhead">
        <h2>{t("security.title")}</h2>
      </div>

      {err && (
        <div className="panel" style={{ borderColor: "var(--advocate)" }}>
          <div className="sub" style={{ color: "var(--advocate)", marginBottom: 0 }}>
            {t("security.totp.invalidCode")}
          </div>
        </div>
      )}

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("security.totp.title")}</h2>
        {status.totpEnabled ? (
          <>
            <div className="sub">{t("security.totp.enabled")}</div>
            <form action={disableTotpAction}>
              <button type="submit" className="tinybtn del">
                {t("security.totp.disable")}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="sub">{t("security.totp.hint")}</div>
            <div className="field">
              <label>{t("security.totp.secretLabel")}</label>
              <input type="text" readOnly dir="ltr" value={enrollment!.secret} style={{ fontFamily: "monospace" }} />
            </div>
            <div className="sub" style={{ fontSize: 12.5, wordBreak: "break-all" }}>
              {enrollment!.uri}
            </div>
            <form action={confirmTotpEnrollAction} style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <input type="hidden" name="secret" value={enrollment!.secret} />
              <input
                type="text"
                name="code"
                dir="ltr"
                inputMode="numeric"
                maxLength={6}
                placeholder={t("auth.login.totpPlaceholder")}
                required
                style={{ flex: 1 }}
              />
              <button type="submit" className="act b-add">
                {t("security.totp.confirm")}
              </button>
            </form>
          </>
        )}
      </div>

      {ipAllowlist !== null && (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>{t("security.ip.title")}</h2>
          <div className="sub">{t("security.ip.hint")}</div>
          <form action={setOfficeIpAllowlistAction}>
            <textarea
              name="entries"
              rows={5}
              dir="ltr"
              defaultValue={ipAllowlist.join("\n")}
              placeholder={"203.0.113.5\n198.51.100.0/24"}
              style={{ width: "100%", fontFamily: "monospace" }}
            />
            <div className="actions" style={{ marginTop: 8 }}>
              <button type="submit" className="act b-add">
                {t("security.ip.save")}
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
