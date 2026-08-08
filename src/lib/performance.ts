import { Prisma, PerformanceEventKind } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Pulse (نبض الفريق) point ledger — feeds the "موظف الأسبوع" (Employee of
 * the Week) card. Fixed point values per real action kind; no fabricated or
 * self-reported points. Called from the services that already perform each
 * action (task completion, hearing recording, document generation, invoice
 * creation, lead conversion) inside their existing transaction.
 */

export const PERFORMANCE_POINTS: Record<PerformanceEventKind, number> = {
  TASK_COMPLETED: 5,
  HEARING_RECORDED: 15,
  DOCUMENT_GENERATED: 8,
  INVOICE_CREATED: 10,
  LEAD_CONVERTED: 20,
};

type Db = Prisma.TransactionClient | typeof prisma;

export async function logPerformance(
  db: Db,
  params: { officeId: string; userId: string; kind: PerformanceEventKind },
): Promise<void> {
  await db.performanceEvent.create({
    data: {
      officeId: params.officeId,
      userId: params.userId,
      kind: params.kind,
      points: PERFORMANCE_POINTS[params.kind],
    },
  });
}
