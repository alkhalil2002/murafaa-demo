import { ArenaRole, CitationAction, GateVerdict } from "@prisma/client";
import { t } from "@/lib/i18n";

type CitationRow = {
  action: CitationAction;
  rawText: string;
  parsedArticleNumber: string | null;
  matchedSource: { title: string; citationKey: string } | null;
};

export type AiAnswerData = {
  arenaRole: ArenaRole | null;
  question: string;
  finalOutput: string;
  verdict: GateVerdict;
  groundingNote: string | null;
  citations: CitationRow[];
};

const VERDICT_COLOR: Record<GateVerdict, string> = {
  PASSED: "var(--ok)",
  FLAGGED: "var(--warn)",
  BLOCKED: "var(--advocate)",
};

const ROLE_LABEL: Record<ArenaRole, string> = {
  OURS: "arenaRole.OURS",
  OPPONENT: "arenaRole.OPPONENT",
  JUDGE: "arenaRole.JUDGE",
};

/**
 * Renders one gated AI answer: the question, the post-gate output, verified
 * source citations, the blocked-count note, and the mandatory disclaimer
 * (docs/02 §6 GATE-DISCLAIMER). Unmatched citations are never shown as sources.
 */
export function AiAnswer({ data }: { data: AiAnswerData }) {
  const kept = data.citations.filter((c) => c.action === CitationAction.KEPT);
  const blocked = data.citations.filter((c) => c.action === CitationAction.BLOCKED).length;

  return (
    <div className="panel">
      <div className="chips" style={{ marginBottom: 8 }}>
        {data.arenaRole && <span className="chip">{t(ROLE_LABEL[data.arenaRole] as never)}</span>}
        <span
          className="chip"
          style={{ color: VERDICT_COLOR[data.verdict], borderColor: VERDICT_COLOR[data.verdict] }}
        >
          {t(`ai.verdict.${data.verdict}` as never)}
        </span>
      </div>

      <p className="sub" style={{ fontWeight: 600, marginBottom: 8 }}>
        {data.question}
      </p>
      <p style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.8 }}>{data.finalOutput}</p>

      {data.groundingNote && (
        <div className="docnote" style={{ marginTop: 10 }}>
          {data.groundingNote}
        </div>
      )}

      {kept.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="sub" style={{ fontWeight: 600, marginBottom: 6 }}>
            {t("ai.sources")}
          </div>
          <div className="chips">
            {kept.map((c, i) => (
              <span className="ref" key={i}>
                {c.matchedSource?.title ?? c.rawText}
                {c.parsedArticleNumber ? ` — ${t("ai.article")} ${c.parsedArticleNumber}` : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {blocked > 0 && (
        <p className="sub" style={{ color: "var(--advocate)", marginTop: 8, marginBottom: 0 }}>
          {t("ai.blockedNote", { n: blocked })}
        </p>
      )}

      <p className="sub" style={{ marginTop: 12, marginBottom: 0, paddingTop: 8, borderTop: "1px solid var(--parch-line)", fontSize: 11 }}>
        ⚖ {t("ai.disclaimer")}
      </p>
    </div>
  );
}
