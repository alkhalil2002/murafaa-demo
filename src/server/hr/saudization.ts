import { EmployeeStatus, PermModule } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AppSession } from "@/lib/auth/types";
import { requireModule } from "@/lib/permissions/guard";
import {
  NITAQAT_BANDS,
  isSaudi,
  nitaqatBand,
  saudisNeeded,
  saudizationPct,
  type NitaqatBandKey,
} from "@/lib/hr/core";

/**
 * Saudization / Nitaqat status for the office (docs/06 §6). Counts ACTIVE
 * employees, derives the current band, and computes the Saudi hires needed to
 * reach each higher band. HR-gated (view). Read-only.
 */

export type SaudizationStatus = {
  total: number;
  saudiCount: number;
  nonSaudiCount: number;
  pct: number;
  band: NitaqatBandKey;
  bandLabelAr: string;
  /** For every band strictly above the current one: Saudis needed to reach it. */
  targets: Array<{ key: NitaqatBandKey; labelAr: string; minPct: number; saudisNeeded: number }>;
};

export async function getSaudizationStatus(session: AppSession): Promise<SaudizationStatus> {
  await requireModule(session, PermModule.HR, "view");
  // Nitaqat headcount = all GOSI-registered staff, i.e. everyone not terminated
  // (ON_LEAVE / SUSPENDED still count); only TERMINATED leaves the workforce.
  const employees = await prisma.employee.findMany({
    where: {
      officeId: session.officeId,
      deletedAt: null,
      status: { not: EmployeeStatus.TERMINATED },
    },
    select: { nationality: true },
  });

  const total = employees.length;
  const saudiCount = employees.filter((e) => isSaudi(e.nationality)).length;
  const pct = saudizationPct(saudiCount, total);
  const band = nitaqatBand(pct);
  const bandDef = NITAQAT_BANDS.find((b) => b.key === band)!;

  const targets = NITAQAT_BANDS.filter((b) => b.minPct > pct).map((b) => ({
    key: b.key,
    labelAr: b.labelAr,
    minPct: b.minPct,
    saudisNeeded: saudisNeeded(saudiCount, total, b.minPct),
  }));

  return {
    total,
    saudiCount,
    nonSaudiCount: total - saudiCount,
    pct,
    band,
    bandLabelAr: bandDef.labelAr,
    targets,
  };
}
