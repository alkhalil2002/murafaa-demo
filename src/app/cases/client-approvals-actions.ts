"use server";

import { redirect } from "next/navigation";
import { ClientApprovalKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { createClientApprovalRequest } from "@/server/client-approvals";
import { riyalsToHalalas } from "@/lib/money";

export async function createClientApprovalRequestAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const title = String(formData.get("title") ?? "");
  const kind = String(formData.get("kind") ?? "") as ClientApprovalKind;
  const amountRaw = formData.get("amount");
  const note = String(formData.get("note") ?? "").trim() || null;
  await createClientApprovalRequest(session, caseId, {
    title,
    kind,
    amount: amountRaw ? riyalsToHalalas(Number(amountRaw)) : null,
    note,
  });
  revalidatePath(`/cases/${caseId}`);
}
