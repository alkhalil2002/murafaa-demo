import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { previewHearingReportPdf } from "@/server/documents";
import { PermissionError } from "@/lib/permissions/guard";

/**
 * Streams a letterhead PDF preview of the hearing wizard's IN-PROGRESS
 * (unsaved) client-report text — nothing is persisted (no Document row, no
 * storage write). Posted to directly from the wizard's step-4 preview button
 * (a submit button's formAction, so the current form's field values are
 * included), and opened in a new tab (docs "⬇ معاينة PDF بالديباجة").
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ data: null, error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const formData = await req.formData();
  const caseId = String(formData.get("caseId") ?? "");
  const clientReport = String(formData.get("clientReport") ?? "");
  try {
    const bytes = await previewHearingReportPdf(session, caseId, clientReport);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename*=UTF-8''preview.pdf",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof PermissionError) {
      return NextResponse.json({ data: null, error: "FORBIDDEN" }, { status: 403 });
    }
    if (err instanceof Error && err.message === "HEARING_HAS_NO_REPORT") {
      return NextResponse.json({ data: null, error: "HEARING_HAS_NO_REPORT" }, { status: 400 });
    }
    return NextResponse.json({ data: null, error: "NOT_FOUND" }, { status: 404 });
  }
}
