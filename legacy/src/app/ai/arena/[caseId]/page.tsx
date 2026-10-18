import { redirect } from "next/navigation";
import Link from "next/link";
import { AiSurface, PermModule } from "@prisma/client";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { AiAnswer } from "@/components/ai-answer";
import { getSession } from "@/lib/auth/session";
import { getCase } from "@/server/cases";
import { listInteractions, getArenaState } from "@/server/ai";
import { canModule } from "@/lib/permissions/engine";
import { loadOfficePolicy } from "@/lib/permissions/policy";
import { PermissionError } from "@/lib/permissions/guard";
import { t } from "@/lib/i18n";
import { arenaRoundAction, arenaResetAction } from "../../actions";

export default async function ArenaPage({ params }: { params: Promise<{ caseId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { caseId } = await params;

  let content: React.ReactNode;
  try {
    const kase = await getCase(session, caseId); // enforces case row-scope
    const arenaState = await getArenaState(session, caseId);
    const turns = (await listInteractions(session, { caseId, threadId: arenaState.threadId })).filter(
      (i) => i.surface === AiSurface.ARENA,
    );
    const policy = await loadOfficePolicy(session.officeId);
    const canGenerate = canModule(policy, session.role, PermModule.AI, "edit");

    content = (
      <>
        <Link href={`/cases/${caseId}`} className="backbtn">
          ‹ {kase.title}
        </Link>
        <div className="vhead">
          <h2>{t("ai.arena")}</h2>
          <span className="pill">{t("ai.arenaHint")}</span>
        </div>

        {canGenerate && (
          <div className="actions">
            <form action={arenaRoundAction}>
              <input type="hidden" name="caseId" value={caseId} />
              <button type="submit" className="act b-add">
                {turns.length === 0
                  ? t("ai.startArena")
                  : t("ai.arenaNextRound", { n: arenaState.roundNumber.toLocaleString("ar-SA") })}
              </button>
            </form>
            {turns.length > 0 && (
              <form action={arenaResetAction}>
                <input type="hidden" name="caseId" value={caseId} />
                <button type="submit" className="tinybtn del">
                  {t("ai.arenaReset")}
                </button>
              </form>
            )}
          </div>
        )}

        {turns.length === 0 ? (
          <div className="panel">
            <div className="sub" style={{ marginBottom: 0 }}>
              {t("ai.startArena")}
            </div>
          </div>
        ) : (
          turns.map((i) => <AiAnswer key={i.id} data={i} />)
        )}
      </>
    );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return <AppShell>{content}</AppShell>;
}
