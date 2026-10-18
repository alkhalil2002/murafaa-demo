import { t } from "@murafaa/i18n";
import { permissionsUsers } from "@murafaa/sdk";
import { PermsDenied, PermsPage } from "@/components/perms/perms-page";
import { UserRoles } from "@/components/perms/user-roles";
import { serverApi } from "@/lib/api";

export default async function PermsUsersPage() {
  const res = await permissionsUsers({ client: await serverApi() });
  const users = res.data?.data;
  return (
    <PermsPage>
      {!users ? (
        <PermsDenied />
      ) : (
        <div className="panel">
          <div className="sub" style={{ marginBottom: 12 }}>
            {t("perms.users.hint")}
          </div>
          <UserRoles users={users} />
        </div>
      )}
    </PermsPage>
  );
}
