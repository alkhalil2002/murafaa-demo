import { redirect } from "next/navigation";
import Link from "next/link";
import { AiSurface, ArenaRole, PermModule } from "@prisma/client";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { AiAnswer } from "@/components/ai-answer";
import { getSession } from "@/lib/auth/session";
import { getCase } from "@/server/cases";
import { listInteractions } from "@/server/ai";
import { canModule } from "@/lib/permissions/engine";
import { loadOfficePolicy } from "@/lib/permissions/policy";
import { PermissionError } from "@/lib/permissions/guard";
import { t } from "@/lib/i18n";
import { arenaTurnAction } from "../../actions";

export default async function ArenaPage({ params }: { params: Promise<{ caseId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { caseId } = await params;

  let content: React.ReactNode;
  try {
    const kase = await getCase(session, caseId); // enforces case row-scope
    const turns = (await listInteractions(session, { caseId, threadId: `arena:${caseId}` })).filter(
      (i) => i.surface === AiSurface.ARENA,
    );
    const policy = await loadOfficePolicy(session.officeId);
    const canGenerate = canModule(policy, session.role, PermModule.AI, "edit");

    content = (
      <>
        <div className="mb-2 flex items-center gap-3">
          <Link href={`/cases/${caseId}`} className="text-sm text-ink-soft hover:underline">
            → {kase.title}
          </Link>
        </div>
        <h1 className="font-serif text-3xl text-bench">{t("ai.arena")}</h1>
        <p className="mt-1 mb-5 text-sm text-ink-soft">{t("ai.arenaHint")}</p>

        {canGenerate && (
          <div className="mb-5 flex flex-wrap gap-2">
            {[ArenaRole.OURS, ArenaRole.OPPONENT, ArenaRole.JUDGE].map((role) => (
              <form key={role} action={arenaTurnAction}>
                <input type="hidden" name="caseId" value={caseId} />
                <input type="hidden" name="role" value={role} />
                <button
                  type="submit"
                  className="rounded-xl border border-bench px-4 py-2 text-sm text-bench hover:bg-bench/5"
                >
                  {t(`arenaRole.${role}` as never)}
                </button>
              </form>
            ))}
          </div>
        )}

        <div className="space-y-3">
          {turns.length === 0 ? (
            <p className="text-ink-soft">{t("ai.startArena")}</p>
          ) : (
            turns.map((i) => <AiAnswer key={i.id} data={i} />)
          )}
        </div>
      </>
    );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return <AppShell>{content}</AppShell>;
}
