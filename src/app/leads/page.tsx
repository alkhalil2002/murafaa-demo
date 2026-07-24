import { redirect } from "next/navigation";
import { LeadStage } from "@prisma/client";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { listLeads } from "@/server/leads";
import { PermissionError } from "@/lib/permissions/guard";
import { leadSourceLabel, leadStageLabel } from "@/lib/labels";
import { formatSar } from "@/lib/money";
import { t } from "@/lib/i18n";

const PIPELINE: LeadStage[] = [
  LeadStage.PROSPECT,
  LeadStage.FIRST_CONSULTATION,
  LeadStage.FEE_PROPOSAL_SENT,
  LeadStage.CONTRACTED,
];

export default async function LeadsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const leads = await listLeads(session);
    content = (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PIPELINE.map((stage) => {
          const inStage = leads.filter((l) => l.stage === stage);
          return (
            <div key={stage} className="rounded-2xl border border-line bg-white p-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-semibold text-bench">{leadStageLabel(stage)}</span>
                <span className="text-xs text-ink-soft">{inStage.length}</span>
              </div>
              <div className="space-y-2">
                {inStage.map((l) => (
                  <div key={l.id} className="rounded-xl border border-parch-line bg-parch p-3 text-sm">
                    <div className="font-medium">{l.name}</div>
                    <div className="mt-1 text-xs text-ink-soft">
                      {leadSourceLabel(l.source)}
                      {l.expectedValue > 0 && <> · {formatSar(l.expectedValue)}</>}
                    </div>
                    {l.nextAction && <div className="mt-1 text-xs text-ink-soft">{l.nextAction}</div>}
                  </div>
                ))}
                {inStage.length === 0 && <p className="text-xs text-ink-soft">{t("common.none")}</p>}
              </div>
            </div>
          );
        })}
      </div>
    );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return (
    <AppShell>
      <h1 className="mb-6 font-serif text-3xl text-bench">{t("leads.title")}</h1>
      {content}
    </AppShell>
  );
}
