import { CitationAction, CitationMatchStatus, CitationType, GateVerdict, KnowledgeSourceType } from "@prisma/client";
import { normalizeName } from "@/lib/conflict/engine";

/**
 * Citation-verification gate (docs/02 §6, CLAUDE.md guardrail #1) — PURE and
 * BLOCKING, the single most important safety control: NO legal AI output reaches
 * a user without every citation matching a real source in the closed knowledge
 * base. Sound by construction, biased to FAIL CLOSED (a wrongly-blocked real
 * citation is acceptable; a passed fabrication is not).
 *
 *  1. Normalize the draft ONCE: strip tashkeel/tatweel, canonicalize the article
 *     word across proclitic/elided forms (المادة/للمادة/بالمادة/وللمادة…), and
 *     collapse whitespace+newlines to single spaces — so orthographic variants
 *     and line-wrapped citations cannot evade the gate.
 *  2. Verify per SENTENCE; a sentence carrying ANY unmatched citation is dropped
 *     wholesale (no offset/substring bookkeeping to get wrong).
 *  3. FAIL CLOSED on the article word: any «المادة …» not resolving to a matched
 *     numeric article of a real active source is unmatched (bare / spelled-out /
 *     fabricated → blocked).
 *  4. KB-ANCHORED matching: a law name is matched only if a real source's name is
 *     an exact token-PREFIX of the cited phrase AND is not followed by another
 *     «ال…» proper-noun token — so a fabricated superset («نظام العمل الموحد
 *     الخليجي») never resolves to a contained real law, while ordinary trailing
 *     prose («نظام العمل نطلب…») still matches. Precedents match by containment
 *     of a distinctive precedent key.
 */

export function toWesternDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** Canonicalize the draft (see principle 1). */
export function normalizeProse(text: string): string {
  return text
    .replace(/[ً-ْٰ]/g, "")
    .replace(/ـ/g, "")
    .replace(/(?:[وفبك])?(?:لل|ال|ل)(ماد[ةه])/g, "ال$1")
    .replace(/\s+/g, " ")
    .trim();
}

export type ParsedCitation = {
  rawText: string;
  type: CitationType;
  parsedLawName: string | null; // raw phrase following the citation (bounded at punctuation)
  parsedArticleNumber: string | null;
};

const RE_ARTICLE = /الماد[ةه]\s*\(?\s*([٠-٩\d]+)?\s*\)?/g;
const RE_PRECEDENT = /(?:سابق[ةه]|مبدأ قضائي|مبدا قضايي|حكم رقم|قرار رقم)[^.؟!]{0,60}/g;

/** Extract raw citations from ONE normalized sentence (matching happens later). */
function extractFromSentence(sentence: string): ParsedCitation[] {
  const out: ParsedCitation[] = [];

  for (const m of sentence.matchAll(RE_ARTICLE)) {
    const number = m[1] ? toWesternDigits(m[1]) : null;
    const tail = sentence.slice((m.index ?? 0) + m[0].length).trimStart();
    const from = /^(?:من|في)\s+((?:نظام|لائح[ةه]).*)$/.exec(tail);
    out.push({
      rawText: m[0].trim(),
      type: CitationType.ARTICLE,
      parsedArticleNumber: number,
      parsedLawName: from ? from[1]!.trim() : null,
    });
  }

  // Standalone statute/regulation mentions — only where «نظام/لائحة» is a WHOLE
  // token (so the common words «نظامي», «النظام», «تنظيمي» don't false-trigger).
  const rawToks = sentence.split(/\s+/);
  const seen = new Set<number>();
  for (let i = 0; i < rawToks.length; i++) {
    const clean = rawToks[i]!.replace(/[.،؛)(]/g, "");
    if ((clean === "نظام" || /^لائح[ةه]$/.test(clean)) && !seen.has(i)) {
      seen.add(i);
      const phrase = rawToks.slice(i).join(" ");
      out.push({ rawText: phrase, type: CitationType.STATUTE, parsedArticleNumber: null, parsedLawName: phrase });
    }
  }

  for (const m of sentence.matchAll(RE_PRECEDENT)) {
    const phrase = m[0].trim();
    out.push({ rawText: phrase, type: CitationType.PRECEDENT, parsedArticleNumber: null, parsedLawName: phrase });
  }

  return out;
}

// ── KB index + matching ──

export type KbSourceRef = {
  id: string;
  citationKey: string;
  title: string;
  type?: KnowledgeSourceType;
  isActive: boolean;
};
export type KbChunkRef = { id: string; sourceId: string; articleNumber: string | null };
export type KbIndex = { sources: KbSourceRef[]; chunks: KbChunkRef[] };

export type VerifiedCitation = ParsedCitation & {
  matchStatus: CitationMatchStatus;
  action: CitationAction;
  matchedSourceId: string | null;
  matchedChunkId: string | null;
};

function tokensOf(s: string): string[] {
  // Strip punctuation so a clinging comma/paren («المدنية،») doesn't break the
  // token-prefix comparison.
  return normalizeName(s)
    .replace(/[.،؛:()«»"']/g, " ")
    .split(" ")
    .filter(Boolean);
}

/**
 * Match a statute/regulation: a real source's name must be an exact token-PREFIX
 * of the cited phrase, and must NOT be followed by another «ال…» token (which
 * would make the cited name a longer/different — fabricated — law). Longest
 * source prefix wins. Precedents are excluded here.
 */
function resolveStatute(lawPhrase: string | null, kb: KbIndex): KbSourceRef | null {
  if (!lawPhrase) return null;
  const toks = tokensOf(lawPhrase);
  if (toks.length === 0) return null;
  let best: KbSourceRef | null = null;
  let bestLen = 0;
  for (const s of kb.sources) {
    if (!s.isActive || s.type === KnowledgeSourceType.PRECEDENT) continue;
    for (const name of [s.citationKey, s.title]) {
      const st = tokensOf(name);
      if (st.length === 0 || st.length > toks.length) continue;
      const isPrefix = st.every((w, i) => w === toks[i]);
      if (!isPrefix) continue;
      const next = toks[st.length];
      if (next && next.startsWith("ال")) continue; // superset / longer proper noun → reject
      if (st.length > bestLen) {
        best = s;
        bestLen = st.length;
      }
    }
  }
  return best;
}

/** Precedents match by containment of a distinctive precedent key/title. */
function resolvePrecedent(phrase: string | null, kb: KbIndex): KbSourceRef | null {
  if (!phrase) return null;
  const n = normalizeName(phrase);
  if (!n) return null;
  let best: KbSourceRef | null = null;
  let bestLen = 0;
  for (const s of kb.sources) {
    if (!s.isActive || s.type !== KnowledgeSourceType.PRECEDENT) continue;
    for (const key of [normalizeName(s.citationKey), normalizeName(s.title)]) {
      if (key && key.length >= 6 && n.includes(key) && key.length > bestLen) {
        best = s;
        bestLen = key.length;
      }
    }
  }
  return best;
}

export function verifyCitation(
  c: ParsedCitation,
  kb: KbIndex,
  mode: "block" | "flag" = "block",
): VerifiedCitation {
  const unmatched = (): VerifiedCitation => ({
    ...c,
    matchStatus: CitationMatchStatus.UNMATCHED,
    action: mode === "block" ? CitationAction.BLOCKED : CitationAction.FLAGGED,
    matchedSourceId: null,
    matchedChunkId: null,
  });
  const matched = (sourceId: string, chunkId: string | null): VerifiedCitation => ({
    ...c,
    matchStatus: CitationMatchStatus.MATCHED,
    action: CitationAction.KEPT,
    matchedSourceId: sourceId,
    matchedChunkId: chunkId,
  });

  if (c.type === CitationType.PRECEDENT) {
    const src = resolvePrecedent(c.parsedLawName, kb);
    return src ? matched(src.id, null) : unmatched();
  }

  if (c.type === CitationType.ARTICLE) {
    if (!c.parsedArticleNumber) return unmatched(); // fail closed: article word w/o number
    const src = resolveStatute(c.parsedLawName, kb);
    if (!src) return unmatched();
    const chunk = kb.chunks.find(
      (ch) =>
        ch.sourceId === src.id &&
        ch.articleNumber != null &&
        toWesternDigits(ch.articleNumber) === c.parsedArticleNumber,
    );
    return chunk ? matched(src.id, chunk.id) : unmatched();
  }

  const src = resolveStatute(c.parsedLawName, kb);
  return src ? matched(src.id, null) : unmatched();
}

export type GateResult = {
  citations: VerifiedCitation[];
  finalOutput: string;
  verdict: GateVerdict;
};

export function runGate(rawDraft: string, kb: KbIndex, mode: "block" | "flag" = "block"): GateResult {
  const prose = normalizeProse(rawDraft);
  const sentences = prose.split(/(?<=[.؟!])\s*/).filter((s) => s.trim().length > 0);

  const citations: VerifiedCitation[] = [];
  const kept: string[] = [];
  for (const sentence of sentences) {
    const verified = extractFromSentence(sentence).map((c) => verifyCitation(c, kb, mode));
    citations.push(...verified);
    const hasBlocked = verified.some((v) => v.action === CitationAction.BLOCKED);
    if (!(mode === "block" && hasBlocked)) kept.push(sentence.trim());
  }

  const finalOutput = kept.join(" ").trim();
  const hasBlocked = citations.some((c) => c.action === CitationAction.BLOCKED);
  const hasFlagged = citations.some((c) => c.action === CitationAction.FLAGGED);
  const verdict = hasBlocked
    ? GateVerdict.BLOCKED
    : hasFlagged
      ? GateVerdict.FLAGGED
      : GateVerdict.PASSED;

  return { citations, finalOutput, verdict };
}

/** KB-independent extraction (used by tests/inspection). */
export function extractCitations(text: string): ParsedCitation[] {
  return normalizeProse(text)
    .split(/(?<=[.؟!])\s*/)
    .filter((s) => s.trim().length > 0)
    .flatMap((s) => extractFromSentence(s));
}
