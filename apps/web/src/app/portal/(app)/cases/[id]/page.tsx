import Link from "next/link";
import { clientPortalCaseDetail } from "@murafaa/sdk";
import { PROC_STAGES } from "@murafaa/rules";
import { t, type MessageKey } from "@murafaa/i18n";
import {
  ChatThread,
  DecidedApproval,
  DocRow,
  PendingApproval,
  UploadHint,
} from "@/components/portal/portal-blocks";
import { PortalUploadForm } from "@/components/portal/portal-forms";
import { serverApi } from "@/lib/api";
import { fmtDate } from "@/lib/dates-ui";
import { arNum } from "@/lib/portal-data";

/** One of the client's cases: stage, dates, approvals, shared documents and the chat. */
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
  const stageIdx = PROC_STAGES.indexOf(c.stage);
  const pending = c.approvals.filter((a) => a.status === "PENDING");
  const decided = c.approvals.filter((a) => a.status !== "PENDING");
  return (
    <>
      <Link href="/portal" className="backbtn">
        ‹ {t("portal.dashboard.title")}
      </Link>
      <div className="vhead">
        <h2>{c.title}</h2>
        <span className={`status ${c.status === "ACTIVE" ? "active" : "done"}`}>
          {t(`case.status.${c.status}` as MessageKey)}
        </span>
        <span className="pill">{c.number}</span>
      </div>
      <div className="statusbar" style={{ marginBottom: 20 }}>
        {PROC_STAGES.map((s, i) => (
          <div key={s} className={`stp${i < stageIdx ? " done" : i === stageIdx ? " cur" : ""}`}>
            {t(`case.stage.${s}` as MessageKey)}
          </div>
        ))}
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
        <div className={`kpi${pending.length > 0 ? " warn" : ""}`}>
          <div className="v">{arNum(pending.length)}</div>
          <div className="l">{t("portal.case.pendingApprovals")}</div>
        </div>
      </div>

      {pending.map((a) => (
        <PendingApproval key={a.id} caseId={c.id} a={a} />
      ))}
      {decided.length > 0 && (
        <div className="panel">
          <h2>{t("portal.approvals.tabDone")}</h2>
          {decided.map((a) => (
            <DecidedApproval key={a.id} a={a} />
          ))}
        </div>
      )}

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="panel">
          <h2>{t("portal.documents.title")}</h2>
          {c.documents.length === 0 ? (
            <div className="sub" style={{ marginBottom: 0 }}>
              {t("portal.documents.empty")}
            </div>
          ) : (
            c.documents.map((d) => <DocRow key={d.id} d={d} />)
          )}
        </div>
        <div className="panel">
          <h2>{t("portal.upload.title")}</h2>
          <UploadHint />
          <PortalUploadForm caseId={c.id} />
        </div>
      </div>

      <div className="panel">
        <h2>{t("portal.nav.chat")}</h2>
        <div className="sub">{t("portal.chat.pill")}</div>
        <ChatThread caseId={c.id} messages={c.messages} />
      </div>
    </>
  );
}
