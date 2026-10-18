import { normalizeName } from "@/lib/conflict/engine";

/**
 * Embedding adapter. Dev uses a deterministic, offline, hash-based bag-of-tokens
 * vector — no network, nothing leaves the machine, and lexical overlap is enough
 * for retrieval over the small closed KB. Production swaps to a Vertex embedding
 * model behind the same interface (regional endpoint, residency deferred config).
 */

export const EMBEDDING_DIM = 64;

export interface Embedder {
  embed(text: string): Promise<number[]>;
}

class StubEmbedder implements Embedder {
  async embed(text: string): Promise<number[]> {
    const v = new Array(EMBEDDING_DIM).fill(0);
    const tokens = normalizeName(text).split(/\s+/).filter(Boolean);
    for (const tok of tokens) {
      let h = 0;
      for (let i = 0; i < tok.length; i++) h = (h * 31 + tok.charCodeAt(i)) >>> 0;
      v[h % EMBEDDING_DIM] += 1;
    }
    const norm = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1;
    return v.map((x) => x / norm);
  }
}

let cached: Embedder | null = null;

export function getEmbedder(): Embedder {
  if (cached) return cached;
  // AI_PROVIDER=vertex would load the regional embedding adapter here (prod).
  cached = new StubEmbedder();
  return cached;
}

/** Cosine similarity of two equal-length vectors. */
export function cosine(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}
