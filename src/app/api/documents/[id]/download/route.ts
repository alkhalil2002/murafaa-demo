import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getPortalSession } from "@/lib/auth/portal-session";
import { getDocumentForDownload } from "@/server/documents";
import { getPortalDocumentForDownload } from "@/server/portal";
import { PermissionError } from "@/lib/permissions/guard";
import { isUuid } from "@/lib/http/params";

/**
 * Authorized document download. Bytes are streamed through this route (never a
 * public bucket URL) so every download is permission-checked, row-scoped, and
 * audited (docs/02 §9 PDPL). Content-Disposition uses RFC 5987 for the Arabic
 * filename. Accepts either a staff AppSession or a client-portal session —
 * the latter is scoped to clientVisible documents on the client's own cases
 * only (src/server/portal.ts#getPortalDocumentForDownload).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const staffSession = await getSession();
  const portalSession = staffSession ? null : await getPortalSession();
  if (!staffSession && !portalSession) {
    return NextResponse.json({ data: null, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { id } = await params;
  // Cheap reject before touching the DB: a non-UUID segment would otherwise
  // raise Prisma P2023 and get swallowed by the catch below as a 404 anyway,
  // after a pointless round trip and a logged database error.
  if (!isUuid(id)) {
    return NextResponse.json({ data: null, error: "NOT_FOUND" }, { status: 404 });
  }
  try {
    const { fileName, mimeType, bytes } = staffSession
      ? await getDocumentForDownload(staffSession, id)
      : await getPortalDocumentForDownload(portalSession!, id);
    const encoded = encodeURIComponent(fileName);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encoded}`,
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof PermissionError) {
      return NextResponse.json({ data: null, error: "FORBIDDEN" }, { status: 403 });
    }
    return NextResponse.json({ data: null, error: "NOT_FOUND" }, { status: 404 });
  }
}
