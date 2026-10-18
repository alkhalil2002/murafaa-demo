import { defineConfig } from "vitest/config";

// The render test launches a real headless Chrome.
export default defineConfig({
  test: { include: ["test/**/*.test.ts"], testTimeout: 60_000, hookTimeout: 60_000 },
});
