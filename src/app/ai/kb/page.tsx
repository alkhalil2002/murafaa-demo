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
        <div className="ftabs">
          <Link href="/ai" className="ftab">
            {t("ai.assistant")}
          </Link>
          <span className="ftab on">{t("ai.kb")}</span>
        </div>
        <div className="panel">
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("ai.disclaimer")}
          </div>
        </div>
        <div className="clist">
          {sources.map((s) => (
            <div key={s.id} className="dcard">
              <div className="chips">
                <span className="chip" style={{ color: "var(--warn)", borderColor: "var(--gold)" }}>
                  {t(TYPE_LABEL[s.type] as never)}
                </span>
                <span className="chip">{t("kb.chunks", { n: s._count.chunks })}</span>
              </div>
              <h3>{s.title}</h3>
              {s.officialRef && <div className="sub" style={{ marginBottom: 0 }}>{s.officialRef}</div>}
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
      <div className="vhead">
        <h2>{t("ai.kb")}</h2>
      </div>
      {content}
    </AppShell>
  );
}
