import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: [path.join(__dirname, "tests/setup/load-env-local.ts")],
    fileParallelism: false,
    maxWorkers: 1,
    reporters: ["default"],
  },
});
