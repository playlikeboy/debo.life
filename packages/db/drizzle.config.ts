import { defineConfig } from "drizzle-kit";

// `neon env pull` writes the connection strings to the repo-root .env.
try {
  process.loadEnvFile("../../.env");
} catch {
  // In CI the values come from the environment instead.
}

const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) throw new Error("DATABASE_URL_UNPOOLED is not set. Run `neon env pull` in the repo root.");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  // Neon Auth owns the neon_auth schema. Only ever touch our own tables.
  schemaFilter: ["public"],
  dbCredentials: { url },
});
