"use server";

import { revalidatePath } from "next/cache";
import { getPlatformSession } from "@/lib/auth/platform-session";
import { createPlan, deletePlan, setPlanActive } from "@/server/platform";

/**
 * Plan catalogue mutations for the platform dashboard.
 *
 * Every action re-reads the platform session rather than trusting anything the
 * form carries: these endpoints change what every tenant is billed, and a
 * server action is a public POST endpoint like any other.
 */

export type PlanActionState = { error?: string; ok?: true };

async function requirePlatform() {
  const session = await getPlatformSession();
  if (!session) throw new Error("FORBIDDEN");
  return session;
}

export async function createPlanAction(
  _prev: PlanActionState,
  form: FormData,
): Promise<PlanActionState> {
  const session = await requirePlatform();

  const seatRaw = String(form.get("seatLimit") ?? "").trim();
  const priceRaw = String(form.get("priceRiyals") ?? "").trim();
  const sortRaw = String(form.get("sortOrder") ?? "").trim();

  const result = await createPlan(session, {
    code: String(form.get("code") ?? "").trim().toLowerCase(),
    nameAr: String(form.get("nameAr") ?? "").trim(),
    // Number("") is 0, which would silently create a free plan. NaN makes the
    // schema reject it instead.
    priceRiyals: priceRaw === "" ? Number.NaN : Number(priceRaw),
    // Blank means unlimited, which is a real choice here, not a missing value.
    seatLimit: seatRaw === "" ? null : Number(seatRaw),
    sortOrder: sortRaw === "" ? 0 : Number(sortRaw),
  });

  if (!result.ok) return { error: result.code };
  revalidatePath("/admin");
  return { ok: true };
}

export async function deletePlanAction(
  _prev: PlanActionState,
  form: FormData,
): Promise<PlanActionState> {
  const session = await requirePlatform();
  const result = await deletePlan(session, String(form.get("id") ?? ""));
  if (!result.ok) return { error: result.code };
  revalidatePath("/admin");
  return { ok: true };
}

export async function togglePlanAction(form: FormData): Promise<void> {
  const session = await requirePlatform();
  await setPlanActive(session, String(form.get("id") ?? ""), form.get("isActive") === "1");
  revalidatePath("/admin");
}
