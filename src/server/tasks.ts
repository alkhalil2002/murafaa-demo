import {
  PermModule,
  Prisma,
  TaskCategory,
  TaskColumn,
  TaskPriority,
  TaskSource,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, requireModule } from "@/lib/permissions/guard";
import { caseScopeWhere } from "@/lib/permissions/scope";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Tasks service (docs/05, docs/06). Kanban board gated by the المهام module.
 * Tasks linked to a case the caller cannot see are hidden (readers' scope
 * enhancement). System-generated tasks are idempotent via a unique
 * (officeId, autoSignature) key.
 */

const createSchema = z.object({
  title: z.string().min(1),
  assigneeId: z.string().uuid().nullish(),
  priority: z.nativeEnum(TaskPriority).optional(),
  dueAt: z.coerce.date().nullish(),
  caseId: z.string().uuid().nullish(),
  category: z.nativeEnum(TaskCategory).nullish(),
});
export type CreateTaskInput = z.infer<typeof createSchema>;

/** IDs of cases the caller may see (for filtering case-linked tasks). */
async function visibleCaseIds(session: AppSession): Promise<Set<string>> {
  const where = await caseScopeWhere(session);
  const rows = await prisma.case.findMany({ where, select: { id: true } });
  return new Set(rows.map((r) => r.id));
}

export async function listTasks(session: AppSession) {
  await requireModule(session, PermModule.TASKS, "view");
  const visible = await visibleCaseIds(session);
  const tasks = await prisma.task.findMany({
    where: { officeId: session.officeId, deletedAt: null },
    orderBy: [{ status: "asc" }, { position: "asc" }, { createdAt: "asc" }],
    include: { assignee: { select: { id: true, name: true } }, case: { select: { id: true, title: true } } },
  });
  // Hide tasks whose linked case is out of scope; office-wide (caseId null) stay.
  return tasks.filter((tk) => !tk.caseId || visible.has(tk.caseId));
}

export async function createTask(session: AppSession, raw: CreateTaskInput) {
  await requireModule(session, PermModule.TASKS, "edit");
  const input = createSchema.parse(raw);
  const created = await prisma.task.create({
    data: {
      officeId: session.officeId,
      createdById: session.userId,
      title: input.title,
      assigneeId: input.assigneeId ?? null,
      priority: input.priority ?? TaskPriority.NORMAL,
      dueAt: input.dueAt ?? null,
      caseId: input.caseId ?? null,
      category: input.category ?? null,
      status: TaskColumn.NEW,
      origin: TaskSource.MANUAL,
    },
  });
  await logAudit({ session, action: "task.create", resource: "tasks", targetId: created.id });
  return created;
}

export async function moveTask(session: AppSession, id: string, status: TaskColumn) {
  await requireModule(session, PermModule.TASKS, "edit");
  const task = await prisma.task.findFirst({
    where: { id, officeId: session.officeId, deletedAt: null },
  });
  if (!task) throw new PermissionError("scope");
  const updated = await prisma.task.update({
    where: { id },
    data: {
      status,
      completedAt: status === TaskColumn.DONE ? new Date() : null,
    },
  });
  await logAudit({ session, action: "task.move", resource: "tasks", targetId: id, detail: status });
  // NOTE: completion performance points feed the Pulse module (Phase 6),
  // credited to task.assigneeId — wired up there.
  return updated;
}

export async function deleteTask(session: AppSession, id: string) {
  await requireModule(session, PermModule.TASKS, "delete");
  const task = await prisma.task.findFirst({
    where: { id, officeId: session.officeId, deletedAt: null },
  });
  if (!task) throw new PermissionError("scope");
  await prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });
  await logAudit({ session, action: "task.delete", resource: "tasks", targetId: id });
}

/**
 * Create a system-generated task at most once per signature (docs BR-TASK-3).
 * Used by hearing automation. Idempotent via unique (officeId, autoSignature).
 * Runs inside the caller's transaction.
 */
export async function createAutoTask(
  db: Db,
  session: Pick<AppSession, "officeId" | "userId">,
  input: {
    caseId: string;
    autoSignature: string;
    title: string;
    assigneeId: string | null;
    priority: TaskPriority;
    category: TaskCategory;
    dueAt: Date | null;
    origin: TaskSource;
  },
): Promise<void> {
  const existing = await db.task.findFirst({
    where: { officeId: session.officeId, autoSignature: input.autoSignature },
    select: { id: true },
  });
  if (existing) return;
  try {
    await db.task.create({
      data: {
        officeId: session.officeId,
        createdById: session.userId,
        title: input.title,
        assigneeId: input.assigneeId,
        priority: input.priority,
        category: input.category,
        dueAt: input.dueAt,
        caseId: input.caseId,
        status: TaskColumn.NEW,
        origin: input.origin,
        autoSignature: input.autoSignature,
      },
    });
  } catch (err) {
    // Concurrent automation already created this signature (unique key) — the
    // check-then-create above has a race window; the constraint is the backstop.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
      throw err;
    }
  }
}
