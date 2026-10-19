import { platformListTeam } from "@murafaa/sdk";
import { t, type MessageKey } from "@murafaa/i18n";
import { InviteForm, MemberControls } from "@/components/platform/team-controls";
import { serverApi } from "@/lib/api";
import { relTime } from "@/lib/dates-ui";

const STATUS_TONE = { ACTIVE: "t-ok", PENDING: "t-warn", DISABLED: "t-neutral" } as const;

/** فريق المنصة (owner only; the API refuses anyone else). */
export default async function PlatformTeamPage() {
  const res = await platformListTeam({ client: await serverApi() });
  const team = res.data?.data;
  if (!team)
    return (
      <div className="panel">
        <div className="sub" style={{ marginBottom: 0 }}>
          {t("errors.FORBIDDEN")}
        </div>
      </div>
    );
  return (
    <>
      <div className="vhead">
        <h2>{t("platform.nav.team")}</h2>
        <span className="pill">{t("platform.team.pill")}</span>
      </div>
      <div className="panel" style={{ overflowX: "auto" }}>
        <table className="htable">
          <thead>
            <tr>
              <th>{t("platform.team.name")}</th>
              <th>{t("platform.team.phone")}</th>
              <th>{t("platform.team.status")}</th>
              <th>{t("platform.team.lastLogin")}</th>
              <th>{t("platform.team.role")}</th>
            </tr>
          </thead>
          <tbody>
            {team.map((m) => (
              <tr key={m.id}>
                <td style={{ fontWeight: 600 }}>{m.name}</td>
                <td dir="ltr" style={{ textAlign: "right" }}>
                  {m.phone}
                </td>
                <td>
                  <span className={`chip ${STATUS_TONE[m.status]}`}>
                    {t(`platform.team.status.${m.status}` as MessageKey)}
                  </span>
                </td>
                <td>{m.lastLoginAt ? relTime(m.lastLoginAt) : t("platform.staff.never")}</td>
                <td>
                  {m.isSelf && (
                    <span className="chip" style={{ marginInlineEnd: 8 }}>
                      {t(`platform.role.${m.role}` as MessageKey)}
                    </span>
                  )}
                  <MemberControls m={m} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel">
        <h2>{t("platform.team.add")}</h2>
        <InviteForm />
      </div>
    </>
  );
}
