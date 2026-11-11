import { AGENT_ID } from "./chat";

/**
 * What the CopilotKit runtime answers at GET /api/copilotkit/info for our
 * setup: one custom BuiltInAgent, SSE mode, telemetry off. The browser asks
 * for this each time the chat page opens.
 *
 * Why a fixed copy: building the answer the normal way loads the whole
 * CopilotKit runtime, which costs about half a second of Worker CPU on a cold
 * Worker, only to send these same few lines. The real runtime still handles
 * every other request (asking, stopping, connecting).
 *
 * `copilot-info.test.ts` checks this against the installed runtime's own
 * answer, so upgrading @copilotkit/runtime fails the test until this matches.
 * Nothing here depends on who is signed in.
 */
export const RUNTIME_INFO = {
  version: "1.85.0",
  agents: {
    [AGENT_ID]: {
      name: AGENT_ID,
      description: "",
      className: "BuiltInAgent",
      capabilities: {
        tools: { supported: true, clientProvided: true },
        transport: { streaming: true },
        humanInTheLoop: { interrupts: true },
      },
    },
  },
  audioFileTranscriptionEnabled: false,
  mode: "sse",
  threadEndpoints: { list: true, inspect: true, mutations: false, realtimeMetadata: false },
  suggestions: true,
  a2uiEnabled: false,
  openGenerativeUIEnabled: false,
  telemetryDisabled: true,
} as const;
