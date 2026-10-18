/**
 * AI-assisted hearing-minutes drafting (prototype wzGen) — turns the lawyer's
 * own raw notes about a hearing into a structured draft (minutes/result/
 * client report) for review before saving. This is drafting assistance over
 * text the lawyer already wrote, NOT legal analysis or citation of law, so it
 * does not go through the RAG + citation-verification gate (docs/02 §6) —
 * but the prompt still forbids inventing facts or article numbers, since the
 * output can end up in a client-facing report.
 *
 * No live provider is wired yet (see CLAUDE.md: AI via Claude on Vertex AI,
 * regional endpoint — no GCP project/credentials exist in this environment).
 * `draftHearingReport` returns `{ unavailable: true }` until ANTHROPIC_API_KEY
 * (dev fallback) or the Vertex adapter is configured, so the UI can show a
 * clear "not connected yet" state instead of fabricating a draft.
 */

export type HearingDraft = {
  minutes: string;
  result: string;
  clientReport: string;
};

export type HearingDraftResult = { ok: true; draft: HearingDraft } | { ok: false; reason: "unavailable" | "error" };

const SYSTEM_PROMPT = `أنت مساعد صياغة لمكتب محاماة سعودي. تُعطى ملاحظات خام كتبها المحامي عن جلسة قضائية للتو.
أعد صياغتها فقط - لا تضف وقائع أو تواريخ أو أرقام مواد نظامية أو نتائج غير واردة صراحة في الملاحظات.
أعد النتيجة بصيغة JSON فقط بالحقول التالية:
- minutes: محضر منظم بصيغة رسمية للملاحظات نفسها
- result: ملخص نتيجة الجلسة في جملة أو جملتين
- clientReport: تقرير مختصر وودود للعميل عمّا جرى، بدون مصطلحات قانونية معقدة
لا تكتب أي شيء خارج كائن الـ JSON.`;

async function callAnthropic(rawNotes: string): Promise<HearingDraft> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: rawNotes }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text ?? "{}";
  const parsed = JSON.parse(text);
  return {
    minutes: String(parsed.minutes ?? ""),
    result: String(parsed.result ?? ""),
    clientReport: String(parsed.clientReport ?? ""),
  };
}

export async function draftHearingReport(rawNotes: string): Promise<HearingDraftResult> {
  if (!rawNotes.trim()) return { ok: false, reason: "error" };
  // TODO(prod): swap to the Claude-on-Vertex regional adapter per CLAUDE.md
  // once a GCP project + service account exist; ANTHROPIC_API_KEY is a dev-only
  // fallback wire-up, not the production path.
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, reason: "unavailable" };
  }
  try {
    const draft = await callAnthropic(rawNotes);
    return { ok: true, draft };
  } catch {
    return { ok: false, reason: "error" };
  }
}
