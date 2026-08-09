"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { TaskCategory, TaskColumn, TaskPriority } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { createTask, moveTask, deleteTask } from "@/server/tasks";

export async function createTaskAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const title = String(formData.get("title") ?? "");
  const assigneeId = String(formData.get("assigneeId") ?? "");
  const priorityRaw = String(formData.get("priority") ?? "");
  const categoryRaw = String(formData.get("category") ?? "");
  const caseId = String(formData.get("caseId") ?? "");
  await createTask(session, {
    title,
    assigneeId: assigneeId || null,
    priority: priorityRaw && priorityRaw in TaskPriority ? (priorityRaw as TaskPriority) : undefined,
    category: categoryRaw && categoryRaw in TaskCategory ? (categoryRaw as TaskCategory) : null,
    caseId: caseId || null,
  });
  revalidatePath("/tasks");
}

export async function moveTaskAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!(status in TaskColumn)) return;
  await moveTask(session, id, status as TaskColumn);
  revalidatePath("/tasks");
}

export async function deleteTaskAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const id = String(formData.get("id") ?? "");
  await deleteTask(session, id);
  revalidatePath("/tasks");
}
