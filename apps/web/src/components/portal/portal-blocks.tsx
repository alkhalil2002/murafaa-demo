import { MAX_PORTAL_UPLOAD_BYTES } from "@murafaa/documents";
import { formatSar, t, type MessageKey } from "@murafaa/i18n";
import type { PortalCase } from "@murafaa/sdk";
import { fmtDate } from "@/lib/dates-ui";
import { IconDocuments } from "../icons";
import { PortalDecideForm, PortalMessageForm } from "./portal-forms";

type Approval = PortalCase["approvals"][number];

const DECIDED_TONE: Record<string, string> = { APPROVED: "t-ok", REJECTED: "t-danger" };

/** A pending approval as its own panel, with the decision form. */
export function PendingApproval({
  caseId,
  caseTitle,
  a,
}: {
  caseId: string;
  caseTitle?: string;
  a: Approval;
}) {
  return (
    <div className="panel">
      <h2>{a.title}</h2>
      {caseTitle && <div className="sub">{caseTitle}</div>}
      <div className="chips">
        <span className="chip">{t(`clientApprovalKind.${a.kind}` as MessageKey)}</span>
        {a.amount != null && (
          <span className="chip">
            {t("portal.approvals.amount")}: {formatSar(a.amount)}
          </span>
        )}
        <span className="chip t-warn">{t("clientApprovalStatus.PENDING")}</span>
      </div>
      {a.note && <div style={{ margin: "12px 0 0" }}>{a.note}</div>}
      <PortalDecideForm caseId={caseId} approvalId={a.id} />
    </div>
  );
}

/** A decided approval as a list row. */
export function DecidedApproval({ a, caseTitle }: { a: Approval; caseTitle?: string }) {
  return (
    <div className="approve-row">
      <span
        className="ndot"
        style={{
          background:
            a.status === "APPROVED" ? "var(--status-success-dot)" : "var(--status-danger-dot)",
        }}
      />
      <span className="at">
        {a.title} <span className="chip">{t(`clientApprovalKind.${a.kind}` as MessageKey)}</span>
        {caseTitle && <span className="chip">{caseTitle}</span>}
        {a.decisionNote && (
          <div className="meta" style={{ marginTop: 4 }}>
            {t("portal.approvals.decisionNote")}: {a.decisionNote}
          </div>
        )}
      </span>
      <span className={`chip ${DECIDED_TONE[a.status] ?? "t-neutral"}`}>
        {t(`clientApprovalStatus.${a.status}` as MessageKey)}
      </span>
    </div>
  );
}

/** A shared document with its download link. */
export function DocRow({
  d,
  caseTitle,
}: {
  d: PortalCase["documents"][number];
  caseTitle?: string;
}) {
  return (
    <div className="tpl">
      <span className="ti">
        <IconDocuments />
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="tt">{d.fileName}</div>
        <div className="tc">
          {caseTitle ? `${caseTitle} · ` : ""}
          {fmtDate(d.createdAt)}
        </div>
      </div>
      <a href={`/api/v1/portal/documents/${d.id}/download`} className="use">
        {t("documents.download")} ←
      </a>
    </div>
  );
}

/** The case chat: the client's messages on one side, the office's on the other. */
export function ChatThread({
  caseId,
  messages,
}: {
  caseId: string;
  messages: PortalCase["messages"];
}) {
  return (
    <>
      {messages.length === 0 ? (
        <div className="sub" style={{ marginBottom: 0 }}>
          {t("portal.chat.empty")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {messages.map((m) => {
            const mine = m.senderType === "CLIENT";
            return (
              <div
                key={m.id}
                style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}
              >
                <div
                  style={{
                    maxWidth: "70%",
                    background: mine ? "var(--bench-50)" : "var(--surface-sunken)",
                    border: `1px solid ${mine ? "var(--bench-100)" : "var(--divider)"}`,
                    borderRadius: "var(--radius-card)",
                    padding: "12px 16px",
                  }}
                >
                  <div>{m.body}</div>
                  <div className="meta" style={{ marginTop: 4, fontSize: "var(--fs-meta)" }}>
                    {mine ? t("portal.chat.you") : t("portal.chat.office")} · {fmtDate(m.createdAt)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <PortalMessageForm caseId={caseId} />
    </>
  );
}

/** Accepted types and the size limit, from the same constants the upload checks. */
export function UploadHint() {
  const mb = (MAX_PORTAL_UPLOAD_BYTES / (1024 * 1024)).toLocaleString("ar-SA");
  return <div className="sub">{t("portal.upload.hint", { mb })}</div>;
}
