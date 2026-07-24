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

const VERDICT_CLASS: Record<GateVerdict, string> = {
  PASSED: "bg-ok/15 text-ok",
  FLAGGED: "bg-gold/20 text-warn",
  BLOCKED: "bg-advocate/15 text-advocate",
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
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        {data.arenaRole && (
          <span className="rounded-full bg-bench/10 px-2 py-0.5 text-xs text-bench">
            {t(ROLE_LABEL[data.arenaRole] as never)}
          </span>
        )}
        <span className={`rounded-full px-2 py-0.5 text-xs ${VERDICT_CLASS[data.verdict]}`}>
          {t(`ai.verdict.${data.verdict}` as never)}
        </span>
      </div>

      <p className="mb-2 text-sm font-medium text-ink-soft">{data.question}</p>
      <p className="whitespace-pre-wrap text-sm leading-8">{data.finalOutput}</p>

      {data.groundingNote && (
        <p className="mt-2 rounded-lg bg-parch px-3 py-2 text-xs text-ink-soft">{data.groundingNote}</p>
      )}

      {kept.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-xs font-semibold text-ink-soft">{t("ai.sources")}</div>
          <ul className="flex flex-wrap gap-2">
            {kept.map((c, i) => (
              <li key={i} className="rounded-lg border border-bench/30 bg-bench/5 px-2.5 py-1 text-xs text-bench">
                {c.matchedSource?.title ?? c.rawText}
                {c.parsedArticleNumber ? ` — ${t("ai.article")} ${c.parsedArticleNumber}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {blocked > 0 && (
        <p className="mt-2 text-xs text-advocate">{t("ai.blockedNote", { n: blocked })}</p>
      )}

      <p className="mt-3 border-t border-parch-line pt-2 text-[11px] text-ink-soft">
        ⚖ {t("ai.disclaimer")}
      </p>
    </div>
  );
}
