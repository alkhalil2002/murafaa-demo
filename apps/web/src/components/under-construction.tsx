import { t, type MessageKey } from "@murafaa/i18n";

/** Placeholder for a screen whose module is not rebuilt yet (see docs/MIGRATION.md). */
export function UnderConstruction({ title }: { title?: MessageKey }) {
  return (
    <>
      {title && (
        <div className="vhead">
          <h2>{t(title)}</h2>
        </div>
      )}
      <div className="panel" style={{ textAlign: "center" }}>
        <p className="sub" style={{ marginBottom: 0 }}>
          {t("common.underConstruction")}
        </p>
      </div>
    </>
  );
}
