// Loads .env.local so the Prisma CLI can read DATABASE_URL during
// `prisma migrate dev`, `prisma generate`, etc. Next.js auto-loads .env.local
// for the app runtime; this config aligns the CLI with that convention.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
