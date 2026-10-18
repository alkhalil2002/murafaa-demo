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
        <div className="ftabs">
          <span className="ftab on">{t("ai.assistant")}</span>
          <Link href="/ai/kb" className="ftab">
            {t("ai.kb")}
          </Link>
        </div>

        {chat.length === 0 ? (
          <div className="panel">
            <div className="sub" style={{ marginBottom: 0 }}>
              {t("ai.emptyChat")}
            </div>
          </div>
        ) : (
          chat.map((i) => <AiAnswer key={i.id} data={i} />)
        )}

        {canGenerate && (
          <form action={askAction} className="panel" style={{ display: "flex", gap: 8, padding: 16 }}>
            <input type="text" name="question" placeholder={t("ai.ask")} style={{ flex: 1 }} />
            <button type="submit" className="act b-add">
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
      <div className="vhead">
        <h2>{t("ai.title")}</h2>
      </div>
      {content}
    </AppShell>
  );
}
