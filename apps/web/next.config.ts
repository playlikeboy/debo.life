import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// `neon env pull` writes `.env` at the repo root. Next only looks in apps/web,
// so load the root file too. Real values never live in the repo.
// forceReload: Next already loaded apps/web and @next/env caches that result.
loadEnvConfig(resolve(process.cwd(), "../.."), process.env.NODE_ENV !== "production", undefined, true);

const config: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source; let Next compile them.
  transpilePackages: ["@debo/db", "@debo/ingest", "@debo/llm"],
};

export default config;
