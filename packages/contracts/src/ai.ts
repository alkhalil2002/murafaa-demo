import { z } from "zod";

const SURFACES = ["ASSISTANT", "CASE_ANALYSIS", "ARENA", "HEARING_DRAFT"] as const;
const ROLES = ["OURS", "OPPONENT", "JUDGE"] as const;
const VERDICTS = ["PASSED", "FLAGGED", "BLOCKED"] as const;
const KB_TYPES = ["STATUTE", "REGULATION", "PRECEDENT"] as const;

/** Whether a model provider is connected; the UI shows "not connected" otherwise. */
export const aiStatus = z
  .object({ connected: z.boolean(), provider: z.string(), region: z.string().nullable() })
  .meta({ id: "AiStatus" });

/** One gated answer: only the post-gate text and the citations that matched a real source. */
export const aiAnswer = z
  .object({
    id: z.uuid(),
    surface: z.enum(SURFACES),
    arenaRole: z.enum(ROLES).nullable(),
    question: z.string(),
    finalOutput: z.string(),
    verdict: z.enum(VERDICTS),
    grounded: z.boolean(),
    blockedCount: z.number().int(),
    citations: z.array(
      z.object({
        rawText: z.string(),
        sourceTitle: z.string(),
        citationKey: z.string(),
        articleNumber: z.string().nullable(),
        isDemo: z.boolean(),
      }),
    ),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "AiAnswer" });
export const aiAnswerList = z.array(aiAnswer).meta({ id: "AiAnswerList" });

export const askBody = z
  .object({ question: z.string().trim().min(1).max(4000), caseId: z.uuid().nullish() })
  .meta({ id: "AskBody" });
export const aiHistoryQuery = z.object({ caseId: z.uuid().optional() });

export const arenaView = z
  .object({ threadId: z.string(), round: z.number().int(), turns: aiAnswerList })
  .meta({ id: "ArenaView" });

export const hearingDraftBody = z
  .object({ notes: z.string().trim().min(1).max(20_000) })
  .meta({ id: "HearingDraftBody" });
/** Gated fields for the hearing wizard; a field whose citation failed the gate comes back without that sentence. */
export const hearingDraft = z
  .object({
    minutes: z.string(),
    result: z.string(),
    clientReport: z.string(),
    verdict: z.enum(VERDICTS),
    blockedCount: z.number().int(),
  })
  .meta({ id: "HearingDraft" });

export const kbSource = z
  .object({
    id: z.uuid(),
    type: z.enum(KB_TYPES),
    title: z.string(),
    citationKey: z.string(),
    officialRef: z.string().nullable(),
    isActive: z.boolean(),
    isDemo: z.boolean(),
    chunks: z.number().int(),
  })
  .meta({ id: "KbSource" });
export const kbSourceList = z.array(kbSource).meta({ id: "KbSourceList" });
export const kbSourceBody = z
  .object({
    type: z.enum(KB_TYPES),
    title: z.string().trim().min(2).max(300),
    citationKey: z.string().trim().min(2).max(300),
    officialRef: z
      .string()
      .trim()
      .max(300)
      .nullish()
      .transform((v) => v || null),
    chunks: z
      .array(
        z.object({
          articleNumber: z
            .string()
            .trim()
            .regex(/^[\d٠-٩]{1,5}$/)
            .nullish(),
          content: z.string().trim().min(1).max(20_000),
        }),
      )
      .min(1)
      .max(2000),
  })
  .meta({ id: "KbSourceBody" });
export const kbActiveBody = z.object({ active: z.boolean() }).meta({ id: "KbActiveBody" });
