import Link from "next/link";
import { aiHistory, aiStatus, authCurrent } from "@murafaa/sdk";
import { t } from "@murafaa/i18n";
import { AiAnswer, AiNotConnected } from "@/components/ai/ai-answer";
import { AskForm } from "@/components/ai/ai-controls";
import { DeniedPanel } from "@/components/denied-panel";
import { serverApi } from "@/lib/api";

/** المساعد القانوني (legacy /ai): the caller's own general questions, gated. */
export default async function AiPage() {
  const api = await serverApi();
  const [history, status, me] = await Promise.all([
    aiHistory({ client: api }),
    aiStatus({ client: api }),
    authCurrent({ client: api }),
  ]);
  const chat = history.data?.data;
  const level = me.data?.data.modules.AI;
  const canGenerate = (level === "EDIT" || level === "FULL") && !me.data?.data.user.previewRole;
  return (
    <>
      <div className="vhead">
        <h2>{t("ai.title")}</h2>
      </div>
      {!chat ? (
        <DeniedPanel />
      ) : (
        <>
          <div className="ftabs">
            <span className="ftab on">{t("ai.assistant")}</span>
            <Link href="/ai/kb" className="ftab">
              {t("ai.kb")}
            </Link>
          </div>
          {status.data && !status.data.data.connected && <AiNotConnected />}
          {chat.length === 0 ? (
            <div className="panel">
              <div className="sub" style={{ marginBottom: 0 }}>
                {t("ai.emptyChat")}
              </div>
            </div>
          ) : (
            chat.slice(-20).map((i) => <AiAnswer key={i.id} data={i} />)
          )}
          {canGenerate && status.data?.data.connected && <AskForm />}
        </>
      )}
    </>
  );
}
