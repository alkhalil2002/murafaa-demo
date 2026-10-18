import { Injectable } from "@nestjs/common";
import { officePerformanceWeights, performanceEvents, type Tx } from "@murafaa/database";
import { type PerformanceEventKind, pointsFor } from "@murafaa/rules";
import { and, eq, isNull } from "drizzle-orm";

/**
 * نبض الفريق points (legacy lib/performance.ts): written by the service that
 * performs a real action, inside its transaction. The office's override wins
 * over the default. The same source (task, hearing, document, invoice, case)
 * earns its points once, so moving a task out of DONE and back is not a second
 * completion (legacy logged it again).
 */
@Injectable()
export class PerformanceService {
  async award(
    tx: Tx,
    officeId: string,
    userId: string,
    kind: PerformanceEventKind,
    sourceId: string,
  ): Promise<void> {
    const [override] = await tx
      .select({ points: officePerformanceWeights.points })
      .from(officePerformanceWeights)
      .where(
        and(eq(officePerformanceWeights.kind, kind), isNull(officePerformanceWeights.deletedAt)),
      );
    await tx
      .insert(performanceEvents)
      .values({
        officeId,
        userId,
        kind,
        points: pointsFor(kind, override?.points),
        sourceId,
        createdBy: userId,
      })
      .onConflictDoNothing();
  }
}
