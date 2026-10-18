import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { globalSearch } from "@/server/search";

/**
 * Live typeahead backing the topbar search (prototype globalSearch inline
 * dropdown) — same globalSearch() the full /search results page uses, just
 * returned as JSON for the client-side dropdown instead of a page render.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ data: null, error: "UNAUTHENTICATED" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q") ?? "";
  const results = await globalSearch(session, q);
  return NextResponse.json({ data: results, error: null });
}
