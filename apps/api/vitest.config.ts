import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// SWC emits decorator metadata, which Nest's dependency injection needs (esbuild does not).
export default defineConfig({
  plugins: [swc.vite()],
  test: { include: ["test/**/*.test.ts"], exclude: ["test/**/*.e2e.test.ts"] },
});
