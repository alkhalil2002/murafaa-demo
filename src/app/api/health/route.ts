import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Liveness + readiness probe for Cloud Run.
 *
 * Checks the database round-trip, not just that the process is up: a container
 * that cannot reach Cloud SQL is not ready to serve, and returning 200 there
 * would let the revision take traffic and fail every request.
 *
 * Deliberately reveals nothing about the deployment — no version, no host, no
 * connection string — because this endpoint is unauthenticated.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
