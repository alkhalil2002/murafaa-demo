import Link from "next/link";
import { clientPortalCaseDetail } from "@murafaa/sdk";
import { formatSar, t, type MessageKey } from "@murafaa/i18n";
import {
  PortalDecideForm,
  PortalMessageForm,
  PortalUploadForm,
} from "@/components/portal/portal-forms";
import { serverApi } from "@/lib/api";
import { fmtDate } from "@/lib/dates-ui";

const DOT: Record<string, string> = {
  APPROVED: "var(--ok)",
  REJECTED: "var(--advocate)",
  PENDING: "var(--gold)",
};

/** One of the client's cases (legacy portal case page): approvals, shared documents, chat. */
export default async function PortalCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = (await clientPortalCaseDetail({ client: await serverApi(), path: { id } })).data?.data;
  if (!c)
    return (
      <div className="panel">
        <div className="sub" style={{ marginBottom: 0 }}>
          {t("portal.notFound")}
        </div>
      </div>
    );
  return (
    <>
      <Link href="/portal" className="backbtn">
        ‹ {t("portal.dashboard.title")}
      </Link>
      <div className="vhead">
        <h2>{c.title}</h2>
        <span className="pill">{t(`case.status.${c.status}` as MessageKey)}</span>
      </div>
      <div className="kpis">
        <div className="kpi">
          <div className="v">{t(`case.stage.${c.stage}` as MessageKey)}</div>
          <div className="l">{t("cases.stage")}</div>
        </div>
        <div className="kpi">
          <div className="v">{c.nextHearing ? fmtDate(c.nextHearing) : t("common.none")}</div>
          <div className="l">{t("cases.nextHearing")}</div>
        </div>
        <div className="kpi">
          <div className="v">{fmtDate(c.objectionDueAt)}</div>
          <div className="l">{t("cases.objectionDue")}</div>
        </div>
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("portal.approvals.title")}</h2>
        {c.approvals.length === 0 ? (
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("portal.approvals.empty")}
          </div>
        ) : (
          c.approvals.map((a) => (
            <div className="panel" key={a.id} style={{ marginBottom: 10 }}>
              <div className="approve-row" style={{ border: "none", padding: 0 }}>
                <span className="ndot" style={{ background: DOT[a.status] }} />
                <span className="at">
                  {a.title}
                  <span className="chip"> {t(`clientApprovalKind.${a.kind}` as MessageKey)}</span>
                  {a.amount != null && (
                    <span className="chip">
                      {" "}
                      {t("portal.approvals.amount")}: {formatSar(a.amount)}
                    </span>
                  )}
                </span>
                <span className="chip st">
                  {t(`clientApprovalStatus.${a.status}` as MessageKey)}
                </span>
              </div>
              {a.note && (
                <div className="sub" style={{ marginTop: 6, marginBottom: 0 }}>
                  {t("portal.approvals.note")}: {a.note}
                </div>
              )}
              {a.decisionNote && (
                <div className="sub" style={{ marginTop: 6, marginBottom: 0 }}>
                  {t("portal.approvals.decisionNote")}: {a.decisionNote}
                </div>
              )}
              {a.status === "PENDING" && <PortalDecideForm caseId={c.id} approvalId={a.id} />}
            </div>
          ))
        )}
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("portal.documents.title")}</h2>
        {c.documents.length === 0 ? (
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("portal.documents.empty")}
          </div>
        ) : (
          c.documents.map((d) => (
            <div className="approve-row" key={d.id}>
              <span className="ndot" style={{ background: "var(--bench)" }} />
              <span className="at">📄 {d.fileName}</span>
              <a href={`/api/v1/portal/documents/${d.id}/download`} className="tinybtn">
                {t("documents.download")}
              </a>
            </div>
          ))
        )}
        <PortalUploadForm caseId={c.id} />
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("cases.chat.title")}</h2>
        <div className="sub">{t("cases.chat.hint")}</div>
        {c.messages.length === 0 ? (
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("cases.chat.empty")}
          </div>
        ) : (
          c.messages.map((m) => (
            <div className="approve-row" key={m.id}>
              <span
                className="ndot"
                style={{ background: m.senderType === "CLIENT" ? "var(--gold)" : "var(--bench)" }}
              />
              <span className="at">
                {m.body}
                <span className="chip">
                  {" "}
                  {m.senderType === "CLIENT"
                    ? t("cases.chat.fromClient")
                    : t("cases.chat.fromOffice")}
                </span>
              </span>
              <span className="chip">{fmtDate(m.createdAt)}</span>
            </div>
          ))
        )}
        <PortalMessageForm caseId={c.id} />
      </div>
    </>
  );
}
