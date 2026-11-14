import type { Config } from "../config.ts";
import { type DeboBackend, deboDatabaseUrl, realBackend } from "./backend.ts";
import { DeboService } from "./service.ts";

export { deboRoutes } from "./routes.ts";
export { DeboService } from "./service.ts";
export {
  addJournalEntryInput,
  askMyLifeInput,
  deboInstructions,
  deboReadTools,
  deboTaskInstructions,
  deboTools,
  searchMyJournalInput,
} from "./tools.ts";

/**
 * The personal brain for this server.
 *
 * It needs the Debo database: DEBO_DATABASE_URL, or DATABASE_URL in a live
 * workspace. In a sample (demo) workspace DATABASE_URL belongs to the demo
 * store, so only an explicit DEBO_DATABASE_URL counts. Without one, the
 * service reports "not set up" and every feature says so plainly.
 */
export function createDebo(
  config: Pick<Config, "mode">,
  env: Record<string, string | undefined> = process.env,
  backend?: DeboBackend,
): DeboService {
  if (backend) return new DeboService(backend);
  const url = config.mode === "sample" ? env.DEBO_DATABASE_URL?.trim() || undefined : deboDatabaseUrl(env);
  return new DeboService(url ? realBackend(url, env) : null);
}
