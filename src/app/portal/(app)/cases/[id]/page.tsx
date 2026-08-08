import Link from "next/link";
import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/auth/portal-session";
import { getPortalCase, listPortalDocuments, listPortalMessages } from "@/server/portal";
import { sendPortalMessageAction } from "../../../actions";
import { caseStatusLabel, stageLabel } from "@/lib/labels";
import { t } from "@/lib/i18n";

function fmt(d: Date | null | undefined): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "—";
}

export default async function PortalCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");
  const { id } = await params;

  let content: React.ReactNode;
  try {
    const [c, documents, messages] = await Promise.all([
      getPortalCase(session, id),
      listPortalDocuments(session, id),
      listPortalMessages(session, id),
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
