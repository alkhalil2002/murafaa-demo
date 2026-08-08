"use server";

import { PermModule } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { requireModule } from "@/lib/permissions/guard";
import { draftHearingReport, type HearingDraftResult } from "@/lib/ai/hearing-draft";

/**
 * Called directly from the client-side wizard (not a <form action>) so the
 * draft can pre-fill sibling fields before the hearing is saved. Same
 * القضايا/edit gate as every other hearing-record action.
 */
export async function draftHearingReportAction(rawNotes: string): Promise<HearingDraftResult> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "error" };
  try {
    await requireModule(session, PermModule.CASES, "edit");
  } catch {
    return { ok: false, reason: "error" };
  }
  return draftHearingReport(rawNotes);
}
