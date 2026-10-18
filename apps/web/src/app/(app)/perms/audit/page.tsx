import { formatWhen, t } from "@murafaa/i18n";
import { permissionsAudit } from "@murafaa/sdk";
import { PermsDenied, PermsPage } from "@/components/perms/perms-page";
import { serverApi } from "@/lib/api";

export default async function PermsAuditPage() {
  const res = await permissionsAudit({ client: await serverApi() });
  const rows = res.data?.data;
  return (
    <PermsPage>
      {!rows ? (
        <PermsDenied />
      ) : (
        <div className="panel">
          <div className="sub" style={{ marginBottom: 12 }}>
            {t("perms.audit.hint")}
          </div>
          {rows.length === 0 ? (
            <div className="sub" style={{ marginBottom: 0 }}>
              {t("perms.audit.empty")}
            </div>
          ) : (
            <div className="clist">
              {rows.map((r) => (
                <div key={r.id} className="dcard">
                  <div style={{ flex: 1 }}>
                    <div dir="ltr" style={{ textAlign: "end" }}>
                      {r.action}
                      {r.detail ? ` — ${r.detail}` : ""}
                    </div>
                    <div className="sub">
                      {r.actorName ?? t("common.system")} · {formatWhen(r.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </PermsPage>
  );
}
