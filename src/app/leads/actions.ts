"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { LeadSource, ClientType, LeadStage } from "@prisma/client";
import { moveLead, setLeadStage, convertLead, createLead, updateLead, deleteLead } from "@/server/leads";

export async function createLeadAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const name = String(formData.get("name") ?? "");
  const typeRaw = String(formData.get("type") ?? "");
  const sourceRaw = String(formData.get("source") ?? "");
  const expectedValueRaw = String(formData.get("expectedValue") ?? "");
  const nextAction = String(formData.get("nextAction") ?? "");
  const phone = String(formData.get("phone") ?? "");
  await createLead(session, {
    name,
    type: typeRaw && typeRaw in ClientType ? (typeRaw as ClientType) : undefined,
    source: sourceRaw && sourceRaw in LeadSource ? (sourceRaw as LeadSource) : undefined,
    expectedValue: expectedValueRaw ? Math.round(Number(expectedValueRaw) * 100) : undefined,
    nextAction: nextAction || null,
    phone: phone || null,
  });
  revalidatePath("/leads");
}

export async function updateLeadAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "");
  const expectedValueRaw = String(formData.get("expectedValue") ?? "");
  const nextAction = String(formData.get("nextAction") ?? "");
  const phone = String(formData.get("phone") ?? "");
  await updateLead(session, id, {
    name,
    expectedValue: expectedValueRaw ? Math.round(Number(expectedValueRaw) * 100) : undefined,
    nextAction: nextAction || null,
    phone: phone || null,
  });
  revalidatePath("/leads");
}

export async function deleteLeadAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const id = String(formData.get("id") ?? "");
  await deleteLead(session, id);
  revalidatePath("/leads");
}

export async function moveLeadAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const dir = Number(formData.get("dir")) === -1 ? -1 : 1;
  await moveLead(session, id, dir);
  revalidatePath("/leads");
}

/** Absolute stage move — used by drag and drop, which can target any column. */
export async function setLeadStageAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const stage = String(formData.get("stage") ?? "");
  if (!(stage in LeadStage)) return;
  await setLeadStage(session, id, stage as LeadStage);
  revalidatePath("/leads");
}

export async function convertLeadAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const id = String(formData.get("id") ?? "");
  await convertLead(session, id);
  revalidatePath("/leads");
  revalidatePath("/clients");
}
