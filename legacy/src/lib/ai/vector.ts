import { prisma } from "@/lib/db";
import { cosine } from "./embed";

/**
 * Vector retrieval over the closed KB. Dev loads active-source chunks and ranks
 * by app-layer cosine similarity (fine for a small closed corpus). Production
 * swaps to pgvector (a `vector` column + `<=>` ANN index) behind this same
 * function — the callers never change.
 */

export type RetrievedChunk = {
  chunkId: string;
  sourceId: string;
  citationKey: string;
  title: string;
  articleNumber: string | null;
  content: string;
  score: number;
};

export async function searchKb(queryEmbedding: number[], k = 5): Promise<RetrievedChunk[]> {
  const chunks = await prisma.knowledgeChunk.findMany({
    where: { source: { isActive: true } },
    include: { source: { select: { citationKey: true, title: true } } },
  });
  return chunks
    .map((ch) => ({
      chunkId: ch.id,
      sourceId: ch.sourceId,
      citationKey: ch.source.citationKey,
      title: ch.source.title,
      articleNumber: ch.articleNumber,
      content: ch.content,
      score: cosine(queryEmbedding, ch.embedding),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/**
 * The full active KB index the gate matches citations against (sources +
 * chunks). Small closed corpus → loaded whole; prod can cache/scope this.
 */
export async function loadKbIndex() {
  const [sources, chunks] = await Promise.all([
    prisma.knowledgeSource.findMany({
      where: { isActive: true },
      select: { id: true, citationKey: true, title: true, type: true, isActive: true },
    }),
    prisma.knowledgeChunk.findMany({
      where: { source: { isActive: true } },
      select: { id: true, sourceId: true, articleNumber: true },
    }),
  ]);
  return { sources, chunks };
}
