import { redirect } from "next/navigation";
import { CaseScope, PermLevel } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { PermsTabs } from "@/components/perms-tabs";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { getSession } from "@/lib/auth/session";
import { getRoleMatrix } from "@/server/permissions-admin";
import { setModuleLevelAction, setRoleCaseScopeAction, setRolePreviewAction } from "./actions";
import { ALL_MODULES, ALL_ROLES } from "@/lib/permissions/matrix";
import { roleLabel, moduleLabel, permLevelLabel } from "@/lib/labels";
import { t } from "@/lib/i18n";

const LEVEL_OPTIONS = [PermLevel.NONE, PermLevel.VIEW, PermLevel.EDIT, PermLevel.FULL].map((l) => ({
  value: l,
  label: permLevelLabel(l),
}));

const SCOPE_OPTIONS = [
  { value: CaseScope.ALL, label: t("perms.roles.scope.all") },
  { value: CaseScope.ASSIGNED, label: t("perms.roles.scope.assigned") },
];

export default async function PermsRolesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const rows = await getRoleMatrix(session);
    content = (
      <>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("perms.roles.preview.title")}</h2>
        <div className="sub" style={{ marginBottom: 12 }}>{t("perms.roles.preview.hint")}</div>
        <form action={setRolePreviewAction} style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <select name="role" defaultValue={ALL_ROLES[1]}>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
          <button type="submit" className="act b-add">
            {t("perms.roles.preview.start")}
          </button>
        </form>
      </div>
      <div className="panel" style={{ overflowX: "auto" }}>
        <div className="sub" style={{ marginBottom: 12 }}>{t("perms.roles.hint")}</div>
        <table className="ptable">
          <thead>
            <tr>
              <th>{t("perms.tab.roles")}</th>
              {ALL_MODULES.map((m) => (
                <th key={m}>{moduleLabel(m)}</th>
              ))}
              <th>{t("perms.roles.scope")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.role}>
                <td style={{ fontWeight: 600 }}>{roleLabel(row.role)}</td>
                {ALL_MODULES.map((m) => (
                  <td key={m}>
                    <AutoSubmitSelect
                      action={setModuleLevelAction}
                      hidden={{ role: row.role, module: m }}
                      name="level"
                      value={row.levels[m] ?? PermLevel.NONE}
                      options={LEVEL_OPTIONS}
                    />
                  </td>
                ))}
                <td>
                  <AutoSubmitSelect
                    action={setRoleCaseScopeAction}
                    hidden={{ role: row.role }}
                    name="scope"
                    value={row.caseScope}
                    options={SCOPE_OPTIONS}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>
    );
  } catch {
    content = (
      <div className="panel">
        <div className="sub" style={{ marginBottom: 0 }}>{t("perms.denied")}</div>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="vhead">
        <h2>{t("perms.title")}</h2>
        <span className="pill">{t("perms.pill")}</span>
      </div>
      <PermsTabs />
      {content}
    </AppShell>
  );
}
