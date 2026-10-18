import Link from "next/link";
import { aiKb, authCurrent } from "@murafaa/sdk";
import { t, type MessageKey } from "@murafaa/i18n";
import { KbActiveToggle, KbAddForm } from "@/components/ai/ai-controls";
import { DeniedPanel } from "@/components/denied-panel";
import { serverApi } from "@/lib/api";

/** القاعدة المعرفية (legacy /ai/kb): the closed corpus the citation gate matches against. */
export default async function KbPage() {
  const api = await serverApi();
  const [kb, me] = await Promise.all([aiKb({ client: api }), authCurrent({ client: api })]);
  const sources = kb.data?.data;
  const canManage = me.data?.data.modules.AI === "FULL" && !me.data.data.user.previewRole;
  return (
    <>
      <div className="vhead">
        <h2>{t("ai.kb")}</h2>
      </div>
      {!sources ? (
        <DeniedPanel />
      ) : (
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
          {sources.length === 0 ? (
            <div className="panel">
              <div className="sub" style={{ marginBottom: 0 }}>
                {t("kb.empty")}
              </div>
            </div>
          ) : (
            <div className="clist">
              {sources.map((s) => (
                <div key={s.id} className="dcard" style={s.isActive ? undefined : { opacity: 0.6 }}>
                  <div className="chips">
                    <span
                      className="chip"
                      style={{ color: "var(--warn)", borderColor: "var(--gold)" }}
                    >
                      {t(`kbType.${s.type}` as MessageKey)}
                    </span>
                    <span className="chip">{t("kb.chunks", { n: s.chunks })}</span>
                    {s.isDemo && <span className="chip">{t("kb.demo")}</span>}
                    {!s.isActive && <span className="chip">{t("kb.inactive")}</span>}
                  </div>
                  <h3>{s.title}</h3>
                  {s.officialRef && (
                    <div className="sub" style={{ marginBottom: 0 }}>
                      {s.officialRef}
                    </div>
                  )}
                  {canManage && (
                    <div style={{ marginTop: 8 }}>
                      <KbActiveToggle id={s.id} active={s.isActive} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {canManage && <KbAddForm />}
        </>
      )}
    </>
  );
}
