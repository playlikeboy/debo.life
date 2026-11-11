import { BuiltInAgent, CopilotRuntime, createCopilotRuntimeHandler } from "@copilotkit/runtime/v2";
import { expect, test } from "vitest";
import { AGENT_ID } from "./chat";
import { RUNTIME_INFO } from "./copilot-info";

// The chat route answers /info from a fixed copy (see copilot-info.ts).
// This checks the copy still matches what the real runtime would say.
test("the fixed /info answer matches the installed CopilotKit runtime", async () => {
  process.env.COPILOTKIT_TELEMETRY_DISABLED = "true";
  const runtime = new CopilotRuntime({
    agents: { [AGENT_ID]: new BuiltInAgent({ type: "custom", factory: async function* () {} }) },
    identifyUser: () => ({ id: "test-person", name: "test-person" }),
  });
  const handler = createCopilotRuntimeHandler({ runtime, basePath: "/api/copilotkit" });
  const response = await handler(new Request("http://localhost/api/copilotkit/info"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(RUNTIME_INFO);
});
