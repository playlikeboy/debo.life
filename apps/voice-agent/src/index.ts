// LiveKit Agents worker for "Talk to Debo". Long-running process, not a
// serverless function, and not deployed yet (DECISIONS.md decision 3).
//
// Switched off until LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET are
// set. Run with `pnpm --filter @debo/voice-agent dev` (or `start`).
import { fileURLToPath } from "node:url";
import { cli, ServerOptions } from "@livekit/agents";

const required = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"] as const;
const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error(`Voice is switched off. Set ${missing.join(", ")} to run the voice agent. See apps/voice-agent/README.md.`);
  process.exit(1);
}

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(new URL("./agent.ts", import.meta.url)),
    wsURL: process.env.LIVEKIT_URL,
    apiKey: process.env.LIVEKIT_API_KEY,
    apiSecret: process.env.LIVEKIT_API_SECRET,
  }),
);
