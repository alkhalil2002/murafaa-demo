import { z } from "zod";

/** Global search (legacy topbar + /api/search): at least 2 characters, up to 8 results per category. */
export const SEARCH_MIN_CHARS = 2;
export const SEARCH_TAKE_PER_CATEGORY = 8;
/** Web/mobile wait this long after typing before querying. */
export const SEARCH_DEBOUNCE_MS = 250;

export const searchQuery = z.object({ q: z.string().trim().min(SEARCH_MIN_CHARS).max(100) });
export type SearchQuery = z.infer<typeof searchQuery>;
