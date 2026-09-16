import { defineConfig } from "vitest/config";
import path from "node:path";

// Minimal vitest config: resolves the "@/*" -> "./src/*" alias declared in
// tsconfig.json so plain `vitest` runs work without extra flags. Added by
// T04 to run its router-determinism unit tests (src/agents/network.router.test.ts);
// T18 (automated test suite) is expected to own/extend this file.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
