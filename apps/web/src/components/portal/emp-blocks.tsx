import { t, type MessageKey } from "@murafaa/i18n";
import type { EmpPortalRequests } from "@murafaa/sdk";
import { fmtDate } from "@/lib/dates-ui";
import { arNum } from "@/lib/portal-data";

export const REQ_TONE: Record<string, string> = {
  SUBMITTED: "t-warn",
  IN_REVIEW: "t-warn",
  APPROVED: "t-ok",
  REJECTED: "t-danger",
};

/** One of the employee's own requests. */
export function RequestRow({ r }: { r: EmpPortalRequests[number] }) {
  return (
    <div className="approve-row">
      <span className="at">
        {t(`reqKind.${r.kind}` as MessageKey)}
        {r.detail ? ` — ${r.detail}` : ""}
        {r.days ? (
          <span className="chip" style={{ marginInlineStart: 8 }}>
            {arNum(r.days)} {t("empPortal.form.days")}
          </span>
        ) : null}
      </span>
      <span className="chip">{fmtDate(r.createdAt)}</span>
      <span className={`chip ${REQ_TONE[r.status] ?? "t-neutral"}`}>
        {t(`reqStatus.${r.status}` as MessageKey)}
      </span>
    </div>
  );
}
