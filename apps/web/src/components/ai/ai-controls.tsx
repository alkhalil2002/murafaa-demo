"use client";

import { useState } from "react";
import {
  aiArenaReset,
  aiArenaRound,
  aiAsk,
  aiHearingDraft,
  aiKbActive,
  aiKbAdd,
} from "@murafaa/sdk";
import type { KbSourceBody } from "@murafaa/sdk";
import { t, type MessageKey } from "@murafaa/i18n";
import { apiErrorKey } from "@/lib/api-error";
import { browserApi } from "@/lib/browser-api";
import { useApiAction } from "@/lib/use-api-action";

function ErrorLine({ error }: { error: MessageKey | null }) {
  return error ? <div className="lerr">{t(error)}</div> : null;
}

/** The question box under the chat (general assistant, or one case when caseId is set). */
export function AskForm({ caseId }: { caseId?: string }) {
  const { run, pending, error } = useApiAction();
  const [formKey, setFormKey] = useState(0);
  return (
    <>
      <form
        key={formKey}
        className="panel"
        style={{ display: "flex", gap: 8, padding: 16 }}
        action={(fd) => {
          const question = String(fd.get("question") ?? "").trim();
          if (!question) return;
          run(
            () => aiAsk({ client: browserApi, body: { question, ...(caseId ? { caseId } : {}) } }),
            () => setFormKey((k) => k + 1),
          );
        }}
      >
        <input type="text" name="question" placeholder={t("ai.ask")} style={{ flex: 1 }} />
        <button type="submit" className="act b-add" disabled={pending}>
          {pending ? t("ai.thinking") : t("ai.send")}
        </button>
      </form>
      <ErrorLine error={error} />
    </>
  );
}

const SMART_TOOLS = [
  "summary",
  "opponent",
  "draft",
  "odds",
  "stage",
  "dates",
  "precedents",
] as const;

/** One-click case questions (legacy AI_SMART_TOOLS). */
export function SmartTools({ caseId }: { caseId: string }) {
  const { run, pending, error } = useApiAction();
  return (
    <>
      <div className="chips" style={{ marginBottom: 12 }}>
        {SMART_TOOLS.map((k) => (
          <button
            key={k}
            type="button"
            className="chip"
            style={{ cursor: "pointer" }}
            disabled={pending}
            onClick={() =>
              run(() =>
                aiAsk({
                  client: browserApi,
                  body: { caseId, question: t(`cases.assistant.tool.${k}.q` as MessageKey) },
                }),
              )
            }
          >
            {t(`cases.assistant.tool.${k}` as MessageKey)}
          </button>
        ))}
      </div>
      {pending && <div className="sub">{t("ai.thinking")}</div>}
      <ErrorLine error={error} />
    </>
  );
}

/** Next round / reset of the pleading arena. */
export function ArenaControls({
  caseId,
  round,
  started,
}: {
  caseId: string;
  round: number;
  started: boolean;
}) {
  const { run, pending, error } = useApiAction();
  return (
    <>
      <div className="actions">
        <button
          type="button"
          className="act b-add"
          disabled={pending}
          onClick={() => run(() => aiArenaRound({ client: browserApi, path: { id: caseId } }))}
        >
          {pending
            ? t("ai.thinking")
            : started
              ? t("ai.arenaNextRound", { n: round.toLocaleString("ar-SA") })
              : t("ai.startArena")}
        </button>
        {started && (
          <button
            type="button"
            className="tinybtn del"
            disabled={pending}
            onClick={() => run(() => aiArenaReset({ client: browserApi, path: { id: caseId } }))}
          >
            {t("ai.arenaReset")}
          </button>
        )}
      </div>
      <ErrorLine error={error} />
    </>
  );
}

type KbType = KbSourceBody["type"];
const KB_TYPES: KbType[] = ["STATUTE", "REGULATION", "PRECEDENT"];

/** "رقم | نص" per line → chunks; a line without "|" is a chunk without an article number. */
function parseChunks(text: string): KbSourceBody["chunks"] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const bar = line.indexOf("|");
      if (bar < 0) return { content: line };
      const articleNumber = line.slice(0, bar).trim();
      const content = line.slice(bar + 1).trim();
      return articleNumber ? { articleNumber, content } : { content };
    })
    .filter((c) => c.content);
}

/** Add a source to the office's closed knowledge base (full AI level). */
export function KbAddForm() {
  const { run, pending, error } = useApiAction();
  const [localError, setLocalError] = useState<MessageKey | null>(null);
  const [formKey, setFormKey] = useState(0);
  return (
    <>
      <form
        key={formKey}
        className="panel"
        action={(fd) => {
          setLocalError(null);
          const chunks = parseChunks(String(fd.get("chunks") ?? ""));
          if (chunks.length === 0) return setLocalError("kb.chunksEmpty");
          const officialRef = String(fd.get("officialRef") ?? "").trim();
          run(
            () =>
              aiKbAdd({
                client: browserApi,
                body: {
                  type: String(fd.get("type")) as KbType,
                  title: String(fd.get("title") ?? "").trim(),
                  citationKey: String(fd.get("citationKey") ?? "").trim(),
                  ...(officialRef ? { officialRef } : {}),
                  chunks,
                },
              }),
            () => setFormKey((k) => k + 1),
          );
        }}
      >
        <h3 style={{ marginBottom: 10 }}>{t("kb.add")}</h3>
        <div className="three">
          <div className="field">
            <label>{t("kb.type")}</label>
            <select name="type" defaultValue="STATUTE">
              {KB_TYPES.map((k) => (
                <option key={k} value={k}>
                  {t(`kbType.${k}` as MessageKey)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>{t("kb.title")}</label>
            <input type="text" name="title" required />
          </div>
          <div className="field">
            <label>{t("kb.citationKey")}</label>
            <input type="text" name="citationKey" required />
          </div>
        </div>
        <div className="field">
          <label>{t("kb.officialRef")}</label>
          <input type="text" name="officialRef" />
        </div>
        <div className="field">
          <label>{t("kb.chunksField")}</label>
          <textarea name="chunks" rows={6} required />
          <div className="sub" style={{ marginTop: 4, marginBottom: 0 }}>
            {t("kb.chunksHint")}
          </div>
        </div>
        <div className="actions">
          <button type="submit" className="act b-add" disabled={pending}>
            {t("kb.save")}
          </button>
        </div>
      </form>
      <ErrorLine error={localError ?? error} />
    </>
  );
}

export function KbActiveToggle({ id, active }: { id: string; active: boolean }) {
  const { run, pending, error } = useApiAction();
  return (
    <>
      <button
        type="button"
        className={`tinybtn${active ? " del" : ""}`}
        disabled={pending}
        onClick={() =>
          run(() => aiKbActive({ client: browserApi, path: { id }, body: { active: !active } }))
        }
      >
        {active ? t("kb.deactivate") : t("kb.activate")}
      </button>
      <ErrorLine error={error} />
    </>
  );
}

type DraftStatus = "idle" | "loading" | "needsNotes" | "done" | MessageKey;

/**
 * "✨ صِغ من الملاحظات" (prototype wzGen, legacy AiDraftHearingButton): sends
 * the wizard's raw notes, then writes the gated draft into the minutes,
 * result and client-report fields of the same form for the lawyer to review.
 */
export function HearingDraftButton({ caseId }: { caseId: string }) {
  const [status, setStatus] = useState<DraftStatus>("idle");

  async function draft(e: React.MouseEvent<HTMLButtonElement>) {
    const form = e.currentTarget.closest("form");
    const field = (name: string) =>
      form?.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
    const notes = field("minutes")?.value.trim() ?? "";
    if (!notes) return setStatus("needsNotes");
    setStatus("loading");
    const res = await aiHearingDraft({ client: browserApi, path: { id: caseId }, body: { notes } });
    if (!res.data) {
      const key = apiErrorKey(res.error);
      return setStatus(key === "errors.AI_UNAVAILABLE" ? "cases.hearings.aiDraftUnavailable" : key);
    }
    const d = res.data.data;
    for (const [name, value] of [
      ["minutes", d.minutes],
      ["result", d.result],
      ["clientReport", d.clientReport],
    ] as const) {
      const el = field(name);
      if (el) el.value = value;
    }
    setStatus("done");
  }

  return (
    <div style={{ marginTop: 8 }}>
      <button type="button" className="tinybtn" onClick={draft} disabled={status === "loading"}>
        {status === "loading" ? t("cases.hearings.aiDraftLoading") : t("cases.hearings.aiDraft")}
      </button>
      {status === "needsNotes" && (
        <div className="sub" style={{ marginTop: 4 }}>
          {t("cases.hearings.aiDraftNeedsNotes")}
        </div>
      )}
      {status === "done" && (
        <div className="sub" style={{ marginTop: 4, color: "var(--ok)" }}>
          {t("cases.hearings.aiDraftDone")}
        </div>
      )}
      {status !== "idle" &&
        status !== "loading" &&
        status !== "needsNotes" &&
        status !== "done" && (
          <div className="sub" style={{ marginTop: 4 }}>
            {t(status)}
          </div>
        )}
    </div>
  );
}
