import Link from "next/link";
import { redirect } from "next/navigation";
import { AiSurface } from "@prisma/client";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { AiAnswer } from "@/components/ai-answer";
import { getSession } from "@/lib/auth/session";
import { listInteractions } from "@/server/ai";
import { canModule } from "@/lib/permissions/engine";
import { loadOfficePolicy } from "@/lib/permissions/policy";
import { PermModule } from "@prisma/client";
import { PermissionError } from "@/lib/permissions/guard";
import { t } from "@/lib/i18n";
import { askAction } from "./actions";

export default async function AiPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const all = await listInteractions(session);
    const chat = all.filter((i) => i.surface !== AiSurface.ARENA).slice(-20);
    const policy = await loadOfficePolicy(session.officeId);
    const canGenerate = canModule(policy, session.role, PermModule.AI, "edit");

    content = (
      <>
        <div className="mb-4 flex flex-wrap gap-2 border-b border-line pb-3 text-sm">
          <span className="rounded-lg bg-bench px-3 py-1.5 text-white">{t("ai.assistant")}</span>
          <Link href="/ai/kb" className="rounded-lg px-3 py-1.5 text-ink-soft hover:bg-white hover:text-bench">
            {t("ai.kb")}
          </Link>
        </div>

        <div className="space-y-3">
          {chat.length === 0 ? (
            <p className="text-ink-soft">{t("ai.emptyChat")}</p>
          ) : (
            chat.map((i) => <AiAnswer key={i.id} data={i} />)
          )}
        </div>

        {canGenerate && (
          <form action={askAction} className="mt-5 flex gap-2">
            <input
              name="question"
              placeholder={t("ai.ask")}
              className="flex-1 rounded-xl border border-line bg-white px-4 py-2.5 text-sm"
            />
            <button type="submit" className="rounded-xl bg-bench px-5 py-2.5 text-sm text-white hover:bg-bench-2">
              {t("ai.send")}
            </button>
          </form>
        )}
      </>
    );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return (
    <AppShell>
      <h1 className="mb-4 font-serif text-3xl text-bench">{t("ai.title")}</h1>
      {content}
    </AppShell>
  );
}
