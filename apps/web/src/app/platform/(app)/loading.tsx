import { t } from "@murafaa/i18n";

/** One-line loading copy + shimmer rows (design system LoadingState). */
export default function Loading() {
  return (
    <div className="panel">
      <div className="loading">
        <div className="lt">
          <span className="spin" />
          {t("portal.loading")}
        </div>
        {[0, 1, 2].map((i) => (
          <div className="skel-row" key={i}>
            <div className="skel" style={{ flex: 1 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
