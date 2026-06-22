import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import dotenv from "dotenv";

// Load .env.local for tests that hit the DB
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text"],
      include: ["lib/**/*.ts", "app/api/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.d.ts", "lib/api/openapi.ts", "lib/schemas/**"],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
