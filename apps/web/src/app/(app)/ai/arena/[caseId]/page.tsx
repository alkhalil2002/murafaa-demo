import Link from "next/link";
import { notFound } from "next/navigation";
import { aiArena, aiStatus, authCurrent, casesDetail } from "@murafaa/sdk";
import { t } from "@murafaa/i18n";
import { AiAnswer, AiNotConnected } from "@/components/ai/ai-answer";
import { ArenaControls } from "@/components/ai/ai-controls";
import { DeniedPanel } from "@/components/denied-panel";
import { serverApi } from "@/lib/api";

/** ساحة المرافعة (legacy /ai/arena/[caseId]): rounds of ours / opponent / judge, each gated. */
export default async function ArenaPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const api = await serverApi();
  const [kase, arena, status, me] = await Promise.all([
    casesDetail({ client: api, path: { id: caseId } }),
    aiArena({ client: api, path: { id: caseId } }),
    aiStatus({ client: api }),
    authCurrent({ client: api }),
  ]);
  const c = kase.data?.data;
  if (!c) notFound();
  const view = arena.data?.data;
  const level = me.data?.data.modules.AI;
  const canGenerate = (level === "EDIT" || level === "FULL") && !me.data?.data.user.previewRole;
  return (
    <>
      <Link href={`/cases/${caseId}`} className="backbtn">
        ‹ {c.title}
      </Link>
      <div className="vhead">
        <h2>{t("ai.arena")}</h2>
        <span className="pill">{t("ai.arenaHint")}</span>
      </div>
      {!view ? (
        <DeniedPanel />
      ) : (
        <>
          {status.data && !status.data.data.connected && <AiNotConnected />}
          {canGenerate && status.data?.data.connected && (
            <ArenaControls caseId={caseId} round={view.round} started={view.turns.length > 0} />
          )}
          {view.turns.length === 0 ? (
            <div className="panel">
              <div className="sub" style={{ marginBottom: 0 }}>
                {t("ai.startArena")}
              </div>
            </div>
          ) : (
            view.turns.map((i) => <AiAnswer key={i.id} data={i} />)
          )}
        </>
      )}
    </>
  );
}
