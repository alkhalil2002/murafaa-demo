import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getDocumentForDownload } from "@/server/documents";
import { PermissionError } from "@/lib/permissions/guard";

/**
 * Authorized document download. Bytes are streamed through this route (never a
 * public bucket URL) so every download is permission-checked, row-scoped, and
 * audited (docs/02 §9 PDPL). Content-Disposition uses RFC 5987 for the Arabic
 * filename.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ data: null, error: "UNAUTHENTICATED" }, { status: 401 });

  const { id } = await params;
  try {
    const { fileName, mimeType, bytes } = await getDocumentForDownload(session, id);
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
