import { ALL_MODULES } from "@murafaa/auth";
import { t } from "@murafaa/i18n";
import { permissionsMatrix } from "@murafaa/sdk";
import { MatrixEditor } from "@/components/perms/matrix-editor";
import { PermsDenied, PermsPage } from "@/components/perms/perms-page";
import { PreviewForm } from "@/components/perms/preview-form";
import { serverApi } from "@/lib/api";

export default async function PermsRolesPage() {
  const res = await permissionsMatrix({ client: await serverApi() });
  const rows = res.data?.data;
  return (
    <PermsPage>
      {!rows ? (
        <PermsDenied />
      ) : (
        <>
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>{t("perms.roles.preview.title")}</h2>
            <div className="sub" style={{ marginBottom: 12 }}>
              {t("perms.roles.preview.hint")}
            </div>
            <PreviewForm />
          </div>
          <div className="panel" style={{ overflowX: "auto" }}>
            <div className="sub" style={{ marginBottom: 12 }}>
              {t("perms.roles.hint")}
            </div>
            <MatrixEditor rows={rows} modules={[...ALL_MODULES]} />
          </div>
        </>
      )}
    </PermsPage>
  );
}
