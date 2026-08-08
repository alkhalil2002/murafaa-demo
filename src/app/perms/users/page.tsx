import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PermsTabs } from "@/components/perms-tabs";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { getSession } from "@/lib/auth/session";
import { listUsersWithRoles } from "@/server/permissions-admin";
import { setUserRoleAction } from "../actions";
import { ALL_ROLES } from "@/lib/permissions/matrix";
import { roleLabel } from "@/lib/labels";
import { t } from "@/lib/i18n";

const ROLE_OPTIONS = ALL_ROLES.map((r) => ({ value: r, label: roleLabel(r) }));

export default async function PermsUsersPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const users = await listUsersWithRoles(session);
    content = (
      <div className="panel">
        <div className="sub" style={{ marginBottom: 12 }}>{t("perms.users.hint")}</div>
        <div className="clist">
          {users.map((u) => (
            <div key={u.id} className="approve-row">
              <span className="at">{u.name}</span>
              <AutoSubmitSelect
                action={setUserRoleAction}
                hidden={{ userId: u.id }}
                name="role"
                value={u.role}
                options={ROLE_OPTIONS}
              />
            </div>
          ))}
        </div>
      </div>
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
