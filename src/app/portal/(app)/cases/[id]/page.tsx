import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientApprovalStatus } from "@prisma/client";
import { getPortalSession } from "@/lib/auth/portal-session";
import { getPortalCase, listPortalApprovals, listPortalDocuments, listPortalMessages } from "@/server/portal";
import { decidePortalApprovalAction, sendPortalMessageAction, uploadPortalDocumentAction } from "../../../actions";
import { caseStatusLabel, clientApprovalKindLabel, clientApprovalStatusLabel, stageLabel } from "@/lib/labels";
import { formatSar } from "@/lib/money";
import { t } from "@/lib/i18n";
import { requireUuidParam } from "@/lib/http/params";
import { formatDateAr } from "@/lib/dates";

function fmt(d: Date | null | undefined): string {
  return formatDateAr(d);
}

export default async function PortalCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");
  const { id } = await params;
  requireUuidParam(id);

  let content: React.ReactNode;
  try {
    const [c, documents, messages, approvals] = await Promise.all([
      getPortalCase(session, id),
      listPortalDocuments(session, id),
      listPortalMessages(session, id),
      listPortalApprovals(session, id),
    ]);

    content = (
      <>
        <Link href="/portal" className="backbtn">
          ‹ {t("portal.dashboard.title")}
        </Link>
        <div className="vhead">
          <h2>{c.title}</h2>
          <span className="pill">{caseStatusLabel(c.status)}</span>
        </div>

        <div className="kpis">
          <div className="kpi">
            <div className="v">{stageLabel(c.stage)}</div>
            <div className="l">{t("cases.stage")}</div>
          </div>
          <div className="kpi">
            <div className="v">{c.upcomingHearing ? fmt(c.upcomingHearing.hearingDate) : t("common.none")}</div>
            <div className="l">{t("cases.nextHearing")}</div>
          </div>
          <div className="kpi">
            <div className="v">{fmt(c.objectionDueAt)}</div>
            <div className="l">{t("cases.objectionDue")}</div>
          </div>
        </div>

        <div className="panel">
          <h2 style={{ marginTop: 0 }}>{t("portal.approvals.title")}</h2>
          {approvals.length === 0 ? (
            <div className="sub" style={{ marginBottom: 0 }}>
              {t("portal.approvals.empty")}
            </div>
          ) : (
            approvals.map((a) => (
              <div className="panel" key={a.id} style={{ marginBottom: 10 }}>
                <div className="approve-row" style={{ border: "none", padding: 0 }}>
                  <span
                    className="ndot"
                    style={{
                      background:
                        a.status === ClientApprovalStatus.APPROVED
                          ? "var(--ok)"
                          : a.status === ClientApprovalStatus.REJECTED
                            ? "var(--advocate)"
                            : "var(--gold)",
                    }}
                  />
                  <span className="at">
                    {a.title}
                    <span className="chip"> {clientApprovalKindLabel(a.kind)}</span>
                    {a.amount != null && <span className="chip"> {t("portal.approvals.amount")}: {formatSar(a.amount)}</span>}
                  </span>
                  <span className="chip st">{clientApprovalStatusLabel(a.status)}</span>
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
                {a.status === ClientApprovalStatus.PENDING && (
                  <form action={decidePortalApprovalAction} style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <input type="hidden" name="caseId" value={id} />
                    <input type="hidden" name="approvalId" value={a.id} />
                    <input type="text" name="note" placeholder={t("portal.approvals.decisionPlaceholder")} style={{ flex: 1 }} />
                    <button type="submit" name="decision" value="approve" className="act b-add">
                      {t("portal.approvals.approve")}
                    </button>
                    <button type="submit" name="decision" value="reject" className="tinybtn del">
                      {t("portal.approvals.reject")}
                    </button>
                  </form>
                )}
              </div>
            ))
          )}
        </div>

        <div className="panel">
          <h2 style={{ marginTop: 0 }}>{t("portal.documents.title")}</h2>
          {documents.length === 0 ? (
            <div className="sub" style={{ marginBottom: 0 }}>
              {t("portal.documents.empty")}
            </div>
          ) : (
            documents.map((d) => (
              <div className="approve-row" key={d.id}>
                <span className="ndot" style={{ background: "var(--bench)" }} />
                <span className="at">📄 {d.fileName}</span>
                <a href={`/api/documents/${d.id}/download`} className="tinybtn">
                  {t("documents.download")}
                </a>
              </div>
            ))
          )}
          <form action={uploadPortalDocumentAction} style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <input type="hidden" name="caseId" value={id} />
            <input type="file" name="file" required style={{ flex: 1 }} />
            <button type="submit" className="act b-add">
              {t("portal.upload.submit")}
            </button>
          </form>
        </div>

        <div className="panel">
          <h2 style={{ marginTop: 0 }}>{t("cases.chat.title")}</h2>
          <div className="sub">{t("cases.chat.hint")}</div>
          {messages.length === 0 ? (
            <div className="sub" style={{ marginBottom: 0 }}>
              {t("cases.chat.empty")}
            </div>
          ) : (
            messages.map((m) => (
              <div className="approve-row" key={m.id}>
                <span className="ndot" style={{ background: m.senderType === "CLIENT" ? "var(--gold)" : "var(--bench)" }} />
                <span className="at">
                  {m.body}
                  <span className="chip"> {m.senderType === "CLIENT" ? t("cases.chat.fromClient") : t("cases.chat.fromOffice")}</span>
                </span>
                <span className="chip">{fmt(m.createdAt)}</span>
              </div>
            ))
          )}
          <form action={sendPortalMessageAction} style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <input type="hidden" name="caseId" value={id} />
            <input type="text" name="body" placeholder={t("cases.chat.placeholder")} required style={{ flex: 1 }} />
            <button type="submit" className="act b-add">
              {t("cases.chat.send")}
            </button>
          </form>
        </div>
      </>
    );
  } catch {
    content = (
      <div className="panel">
        <div className="sub" style={{ marginBottom: 0 }}>
          {t("portal.notFound")}
        </div>
      </div>
    );
  }

  return content;
}
