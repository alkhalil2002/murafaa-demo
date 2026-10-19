"use client";

import { useState } from "react";
import {
  platformInvite,
  type PlatformMember,
  platformResetMember,
  platformUpdateMember,
} from "@murafaa/sdk";
import { PLATFORM_ROLES } from "@murafaa/auth";
import { t, type MessageKey } from "@murafaa/i18n";
import { browserApi } from "@/lib/browser-api";
import { useApiAction } from "@/lib/use-api-action";

const roleLabel = (r: string) => t(`platform.role.${r}` as MessageKey);

/** The activation link, shown once with a copy button. */
function LinkBox({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="docnote" style={{ marginTop: 16 }}>
      <b>{t("platform.team.linkTitle")}</b>
      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "8px 0" }}>
        <input
          className="input"
          dir="ltr"
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
        />
        <button
          type="button"
          className="mini"
          onClick={() => {
            void navigator.clipboard?.writeText(link);
            setCopied(true);
          }}
        >
          {copied ? t("platform.team.copied") : t("platform.team.copy")}
        </button>
      </div>
      <div className="meta" style={{ marginTop: 0 }}>
        {t("platform.team.linkNote")}
      </div>
    </div>
  );
}

/** إضافة عضو: name, phone and role → a one-time activation link. */
export function InviteForm() {
  const { run, pending, error } = useApiAction();
  const [link, setLink] = useState<string | null>(null);
  const [role, setRole] = useState<(typeof PLATFORM_ROLES)[number]>("SUPPORT");
  const [key, setKey] = useState(0);
  return (
    <>
      <form
        key={key}
        action={(fd) => {
          setLink(null);
          run(
            async () => {
              const res = await platformInvite({
                client: browserApi,
                body: {
                  name: String(fd.get("name") ?? ""),
                  phone: String(fd.get("phone") ?? ""),
                  role,
                },
              });
              if (res.data) setLink(res.data.data.link);
              return res;
            },
            () => setKey((k) => k + 1),
          );
        }}
      >
        <div className="two">
          <div className="field">
            <label>{t("platform.team.name")}</label>
            <input name="name" className="input" required minLength={2} />
          </div>
          <div className="field">
            <label>{t("platform.team.phone")}</label>
            <div className="phone">
              <span className="cc">+966</span>
              <input
                name="phone"
                className="input"
                dir="ltr"
                inputMode="numeric"
                required
                placeholder={t("auth.login.phonePlaceholder")}
              />
            </div>
          </div>
        </div>
        <div className="field">
          <label>{t("platform.team.role")}</label>
          <div className="roles">
            {PLATFORM_ROLES.map((r) => (
              <button
                type="button"
                key={r}
                className={`role${role === r ? " sel" : ""}`}
                style={{ textAlign: "start", font: "inherit" }}
                onClick={() => setRole(r)}
              >
                <b>{roleLabel(r)}</b>
                <small>{t(`platform.roleHint.${r}` as MessageKey)}</small>
              </button>
            ))}
          </div>
        </div>
        <button type="submit" className="act b-primary" disabled={pending}>
          {t("platform.team.invite")}
        </button>
        {error && <div className="lerr">{t(error)}</div>}
      </form>
      {link && <LinkBox link={link} />}
    </>
  );
}

/** Role, enable/disable and a new link for one member (never for yourself). */
export function MemberControls({ m }: { m: PlatformMember }) {
  const { run, pending, error } = useApiAction();
  const [link, setLink] = useState<string | null>(null);
  if (m.isSelf) return <span className="chip">{t("platform.team.you")}</span>;
  const patch = (body: { role?: PlatformMember["role"]; isActive?: boolean }) =>
    run(() => platformUpdateMember({ client: browserApi, path: { id: m.id }, body }));
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <select
        className="permSelect"
        value={m.role}
        disabled={pending || m.status === "DISABLED"}
        onChange={(e) => patch({ role: e.target.value as PlatformMember["role"] })}
      >
        {PLATFORM_ROLES.map((r) => (
          <option key={r} value={r}>
            {roleLabel(r)}
          </option>
        ))}
      </select>
      {m.status === "DISABLED" ? (
        <button
          type="button"
          className="tinybtn"
          disabled={pending}
          onClick={() => patch({ isActive: true })}
        >
          {t("platform.team.enable")}
        </button>
      ) : (
        <>
          <button
            type="button"
            className="tinybtn"
            disabled={pending}
            onClick={() =>
              window.confirm(t("platform.team.resetConfirm")) &&
              run(async () => {
                const res = await platformResetMember({ client: browserApi, path: { id: m.id } });
                if (res.data) setLink(res.data.data.link);
                return res;
              })
            }
          >
            {t("platform.team.reset")}
          </button>
          <button
            type="button"
            className="tinybtn del"
            disabled={pending}
            onClick={() =>
              window.confirm(t("platform.team.disableConfirm")) && patch({ isActive: false })
            }
          >
            {t("platform.team.disable")}
          </button>
        </>
      )}
      {error && (
        <span className="lerr" style={{ margin: 0 }}>
          {t(error)}
        </span>
      )}
      {link && (
        <div style={{ flexBasis: "100%" }}>
          <LinkBox link={link} />
        </div>
      )}
    </div>
  );
}
