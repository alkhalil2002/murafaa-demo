import { t } from "@murafaa/i18n";
import { PermsTabs } from "./perms-tabs";

/** Shared header + tabs for the الصلاحيات screens (legacy /perms layout). */
export function PermsPage({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="vhead">
        <h2>{t("perms.title")}</h2>
        <span className="pill">{t("perms.pill")}</span>
      </div>
      <PermsTabs />
      {children}
    </>
  );
}

/** Shown when the API refuses (non-partner, or partner previewing another role). */
export function PermsDenied() {
  return (
    <div className="panel">
      <div className="sub" style={{ marginBottom: 0 }}>
        {t("perms.denied")}
      </div>
    </div>
  );
}
