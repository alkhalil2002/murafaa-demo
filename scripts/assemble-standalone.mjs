/**
 * Copies the assets Next does NOT trace into .next/standalone.
 *
 * `output: "standalone"` emits a server plus its traced node_modules, but
 * deliberately leaves out .next/static, public/, and Prisma's generated client
 * and query engine. Without this step the standalone server boots and then
 * serves an unstyled page with no icons — and throws on the first query.
 *
 * The Dockerfile performs the same copies as explicit COPY layers; this script
 * makes `npm start` work locally the same way.
 */
import { cp, access } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, ".next", "standalone");

const COPIES = [
  [".next/static", ".next/static"],
  ["public", "public"],
  ["node_modules/.prisma", "node_modules/.prisma"],
  ["node_modules/@prisma", "node_modules/@prisma"],
];

const exists = (p) => access(p).then(() => true, () => false);

for (const [from, to] of COPIES) {
  const src = path.join(ROOT, from);
  if (!(await exists(src))) continue;
  await cp(src, path.join(OUT, to), { recursive: true, force: true });
  console.info(`standalone: + ${from}`);
}
