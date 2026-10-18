import type { AiAnswer as AiAnswerData } from "@murafaa/sdk";
import { t, type MessageKey } from "@murafaa/i18n";

const VERDICT_COLOR: Record<AiAnswerData["verdict"], string> = {
  PASSED: "var(--ok)",
  FLAGGED: "var(--warn)",
  BLOCKED: "var(--advocate)",
};

/**
 * One gated AI answer (legacy AiAnswer): the question, the post-gate text,
 * the verified sources, the blocked-count note and the mandatory disclaimer
 * (docs/02 §6 GATE-DISCLAIMER). The API sends only sources that matched the
 * knowledge base; nothing unmatched is ever shown as a source.
 */
export function AiAnswer({ data }: { data: AiAnswerData }) {
  const color = VERDICT_COLOR[data.verdict];
  return (
    <div className="panel">
      <div className="chips" style={{ marginBottom: 8 }}>
        {data.arenaRole && (
          <span className="chip">{t(`arenaRole.${data.arenaRole}` as MessageKey)}</span>
        )}
        <span className="chip" style={{ color, borderColor: color }}>
          {t(`ai.verdict.${data.verdict}` as MessageKey)}
        </span>
      </div>
      {data.surface !== "ARENA" && (
        <p className="sub" style={{ fontWeight: 600, marginBottom: 8 }}>
          {data.question}
        </p>
      )}
      {data.finalOutput ? (
        <p style={{ whiteSpace: "pre-wrap", fontSize: 17.5, lineHeight: 1.8 }}>
          {data.finalOutput}
        </p>
      ) : (
        <p className="sub" style={{ color: "var(--advocate)" }}>
          {t("ai.allBlocked")}
        </p>
      )}
      {!data.grounded && (
        <div className="docnote" style={{ marginTop: 10 }}>
          {t("ai.groundingEmpty")}
        </div>
      )}
      {data.citations.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="sub" style={{ fontWeight: 600, marginBottom: 6 }}>
            {t("ai.sources")}
          </div>
          <div className="chips">
            {data.citations.map((c, i) => (
              <span className="ref" key={i}>
                {c.sourceTitle}
                {c.articleNumber ? ` — ${t("ai.article")} ${c.articleNumber}` : ""}
                {c.isDemo ? ` · ${t("kb.demo")}` : ""}
              </span>
            ))}
          </div>
        </div>
      )}
      {data.blockedCount > 0 && (
        <p className="sub" style={{ color: "var(--advocate)", marginTop: 8, marginBottom: 0 }}>
          {t("ai.blockedNote", { n: data.blockedCount })}
        </p>
      )}
      <p
        className="sub"
        style={{
          marginTop: 12,
          marginBottom: 0,
          paddingTop: 8,
          borderTop: "1px solid var(--parch-line)",
          fontSize: 13.75,
        }}
      >
        ⚖ {t("ai.disclaimer")}
      </p>
    </div>
  );
}

/** Shown wherever AI is offered while no model provider is configured. */
export function AiNotConnected() {
  return (
    <div className="panel" style={{ borderColor: "var(--gold)" }}>
      <div className="sub" style={{ marginBottom: 0, color: "var(--warn)" }}>
        {t("ai.notConnected")}
      </div>
    </div>
  );
}
