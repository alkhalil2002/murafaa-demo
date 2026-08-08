"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { CaseOutcome } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { FeeType } from "@prisma/client";
import { createCase, setCaseOutcome } from "@/server/cases";
import { generateInvoiceFromFee, saveFeeAgreement } from "@/server/fees";
import { riyalsToHalalas } from "@/lib/money";

export async function createCaseAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");

  const clientId = String(formData.get("clientId") ?? "") || null;
  const opposingParty = String(formData.get("opposingParty") ?? "").trim() || null;

  const created = await createCase(session, {
    number: String(formData.get("number") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    clientRole: (formData.get("clientRole") as "PLAINTIFF" | "DEFENDANT") ?? undefined,
    clientId,
    opposingParty,
    najizMainClass: String(formData.get("najizMainClass") ?? "") || null,
    najizSubClass: String(formData.get("najizSubClass") ?? "") || null,
    najizCaseType: String(formData.get("najizCaseType") ?? "") || null,
    city: String(formData.get("city") ?? "") || null,
    assigneeIds: formData.getAll("assigneeIds").map(String),
  });

  revalidatePath("/cases");
  redirect(`/cases/${created.id}`);
}

export async function setOutcomeAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const raw = String(formData.get("outcome") ?? "");
  const outcome = raw && raw in CaseOutcome ? (raw as CaseOutcome) : null;
  await setCaseOutcome(session, caseId, outcome);
  revalidatePath(`/cases/${caseId}`);
}

export async function generateFeeInvoiceAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  await generateInvoiceFromFee(session, caseId);
  revalidatePath(`/cases/${caseId}`);
}

export async function saveFeeAgreementAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const typeRaw = String(formData.get("type") ?? "");
  const type = typeRaw && typeRaw in FeeType ? (typeRaw as FeeType) : FeeType.FLAT;
  const valueRiyals = Number(formData.get("feeValue") ?? "");
  const percentage = Number(formData.get("percentage") ?? "");
  const awardedRiyals = Number(formData.get("awarded") ?? "");
  await saveFeeAgreement(session, caseId, {
    type,
    feeValueMinor: Number.isFinite(valueRiyals) && valueRiyals > 0 ? riyalsToHalalas(valueRiyals) : null,
    percentageBps: Number.isFinite(percentage) && percentage > 0 ? Math.round(percentage * 100) : null,
    awardedMinor: Number.isFinite(awardedRiyals) && awardedRiyals > 0 ? riyalsToHalalas(awardedRiyals) : null,
  });
  revalidatePath(`/cases/${caseId}`);
}
