import Link from "next/link";
import { redirect } from "next/navigation";
import { KnowledgeSourceType } from "@prisma/client";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { listKnowledgeSources } from "@/server/ai";
import { PermissionError } from "@/lib/permissions/guard";
import { t } from "@/lib/i18n";

const TYPE_LABEL: Record<KnowledgeSourceType, string> = {
  STATUTE: "kbType.STATUTE",
  REGULATION: "kbType.REGULATION",
  PRECEDENT: "kbType.PRECEDENT",
};

export default async function KbPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const sources = await listKnowledgeSources(session);
    content = (
      <>
        <div className="mb-4 flex flex-wrap gap-2 border-b border-line pb-3 text-sm">
          <Link href="/ai" className="rounded-lg px-3 py-1.5 text-ink-soft hover:bg-white hover:text-bench">
            {t("ai.assistant")}
          </Link>
          <span className="rounded-lg bg-bench px-3 py-1.5 text-white">{t("ai.kb")}</span>
        </div>
        <p className="mb-4 text-sm text-ink-soft">{t("ai.disclaimer")}</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {sources.map((s) => (
            <div key={s.id} className="rounded-2xl border border-line bg-white p-4">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs text-warn">
                  {t(TYPE_LABEL[s.type] as never)}
                </span>
                <span className="text-xs text-ink-soft">{t("kb.chunks", { n: s._count.chunks })}</span>
              </div>
              <div className="mt-2 font-medium">{s.title}</div>
              {s.officialRef && <div className="mt-1 text-xs text-ink-soft">{s.officialRef}</div>}
            </div>
          ))}
        </div>
      </>
    );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return (
    <AppShell>
      <h1 className="mb-4 font-serif text-3xl text-bench">{t("ai.kb")}</h1>
      {content}
    </AppShell>
  );
}
