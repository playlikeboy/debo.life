import type { Config } from "../config.ts";
import { ffmpegTools, fakeAudioTools } from "./audio.ts";
import { type MediaDeps } from "./media-service.ts";
import { memoryStore } from "./dev-store.ts";
import { r2ConfigFromEnv, r2Store } from "./object-store.ts";
import { cloudflareWhisper, fakeTranscriber } from "./transcriber.ts";
import { type DeboBackend, deboDatabaseUrl, realBackend } from "./backend.ts";
import { devMemoryBackend } from "./dev-backend.ts";
import { DeboService } from "./service.ts";

export { deboRoutes } from "./routes.ts";
export { DeboService } from "./service.ts";
export { MediaService, type MediaDeps } from "./media-service.ts";
export {
  addJournalEntryInput,
  askMyLifeInput,
  deboInstructions,
  deboReadTools,
  deboTaskInstructions,
  deboTools,
  searchMyJournalInput,
} from "./tools.ts";

/** DEBO_DEV_MEMORY=1 asks for the dev-only in-memory journal. */
export function devMemoryRequested(env: Record<string, string | undefined> = process.env): boolean {
  return ["1", "true", "on"].includes(env.DEBO_DEV_MEMORY?.trim().toLowerCase() ?? "");
}

/**
 * Where recordings are kept and who writes them out, from the environment:
 * R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET (the bucket),
 * and CF_AI_API_TOKEN for the speech service (Cloudflare Workers AI, same account).
 * Without the bucket there are no recordings. Without the token recordings are
 * kept but nothing can be written out.
 */
export function mediaFromEnv(env: Record<string, string | undefined>): MediaDeps | undefined {
  const r2 = r2ConfigFromEnv(env);
  if (!r2) return undefined;
  const apiToken = env.CF_AI_API_TOKEN?.trim();
  return {
    store: r2Store(r2),
    audio: ffmpegTools(),
    transcriber: apiToken ? cloudflareWhisper({ accountId: r2.accountId, apiToken }) : undefined,
  };
}

/**
 * The personal brain for this server.
 *
 * It needs the Debo database: DEBO_DATABASE_URL, or DATABASE_URL in a live
 * workspace. In a sample (demo) workspace DATABASE_URL belongs to the demo
 * store, so only an explicit DEBO_DATABASE_URL counts. Without one, the
 * service reports "not set up" and every feature says so plainly.
 */
export function createDebo(
  config: Pick<Config, "mode"> & { publicUrl?: string },
  env: Record<string, string | undefined> = process.env,
  backend?: DeboBackend,
  media?: MediaDeps,
): DeboService {
  if (backend) return new DeboService(backend, [], media);
  if (devMemoryRequested(env)) {
    // Never in a live workspace: it would look like a real journal and forget everything.
    if (config.mode !== "sample")
      throw new Error("DEBO_DEV_MEMORY is for sample workspaces only. Remove it from a live workspace.");
    console.warn("[Debo] DEV ONLY: the journal is in memory and is forgotten when the server stops.");
    // Recordings work too: an in-memory bucket (served under /api/dev-r2) and a fake speech engine.
    const store = memoryStore((config.publicUrl ?? "http://localhost:8787").replace(/\/$/, ""));
    const service = new DeboService(devMemoryBackend(), ["local-user"], {
      store,
      audio: fakeAudioTools({ durationSeconds: 12 }),
      transcriber: fakeTranscriber(),
      // Small sizes, so a few-megabyte test file goes up in parts like a big one would.
      singleMaxBytes: 2 * 1024 * 1024,
      partBytes: 1024 * 1024,
    });
    service.devStore = store.routes();
    return service;
  }
  const url = config.mode === "sample" ? env.DEBO_DATABASE_URL?.trim() || undefined : deboDatabaseUrl(env);
  return new DeboService(url ? realBackend(url, env) : null, [], url ? mediaFromEnv(env) : undefined);
}
