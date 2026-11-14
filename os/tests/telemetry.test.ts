import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

const run = promisify(execFile);
const agentUrl = new URL("../apps/server/src/agent.ts", import.meta.url).href;
const appUrl = new URL("../apps/server/src/app.ts", import.meta.url).href;
const threadsUrl = new URL("../apps/server/src/threads.ts", import.meta.url).href;
const runnerUrl = new URL("../apps/server/src/thread-runner.ts", import.meta.url).href;
const dbUrl = new URL("../apps/server/src/db.ts", import.meta.url).href;
const tsxUrl = import.meta.resolve("tsx");

// A fresh process exercises config loading before the SDK creates its telemetry singleton.
// Replace fetch before importing the runtime so no test can send anything to the network.
const probe = `
const requests = [];
globalThis.fetch = async (url, options = {}) => {
  let body = null;
  try { body = JSON.parse(options.body); } catch {}
  requests.push({ url: String(url), headers: options.headers, body });
  return new Response('{"ok":true}', { status: 202 });
};
await import(${JSON.stringify(appUrl)});
const { makeRuntime } = await import(${JSON.stringify(agentUrl)});
const { ThreadStore } = await import(${JSON.stringify(threadsUrl)});
const { DatabaseAgentRunner } = await import(${JSON.stringify(runnerUrl)});
const { createStore } = await import(${JSON.stringify(dbUrl)});
const store = await createStore();
const handler = makeRuntime(
  { agentBackend: "sample" },
  {},
  { owner: async () => "local-user" },
  new DatabaseAgentRunner(new ThreadStore(store)),
);
const info = await handler.request("/api/copilotkit/info");
await info.text();
await new Promise(resolve => setTimeout(resolve, 50));
await store.close();
console.log(JSON.stringify(requests));
`;

async function captureRuntime(envOverrides: Record<string, string> = {}) {
  const directory = await mkdtemp(join(tmpdir(), "debo-telemetry-test-"));
  const env = { ...process.env };
  for (const key of [
    "DO_NOT_TRACK",
    "DEBO_TELEMETRY",
    "COPILOTKIT_TELEMETRY_DISABLED",
    "COPILOTKIT_TELEMETRY_SAMPLE_RATE",
    "COPILOTKIT_LICENSE_TOKEN",
    "COPILOTKIT_TELEMETRY_URL",
    "CPK_TELEMETRY_ID",
    "CPK_INTELLIGENCE_API_KEY",
  ])
    delete env[key];
  try {
    const { stdout } = await run(
      process.execPath,
      ["--import", tsxUrl, "--input-type=module", "--eval", probe],
      { cwd: directory, env: { ...env, ...envOverrides }, timeout: 60000 },
    );
    return JSON.parse(stdout.trim().split("\n").at(-1) ?? "[]");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("by default nothing is sent, even with a CopilotKit identity and project key in the environment", async () => {
  assert.deepEqual(await captureRuntime(), []);
  assert.deepEqual(
    await captureRuntime({
      CPK_TELEMETRY_ID: "test-project-identity",
      CPK_INTELLIGENCE_API_KEY: "test-project-key-never-sent",
    }),
    [],
  );
});

test("an old opt-out-style setting cannot turn telemetry on", async () => {
  // COPILOTKIT_TELEMETRY_DISABLED=false used to mean "send". Now only DEBO_TELEMETRY opts in.
  assert.deepEqual(
    await captureRuntime({
      COPILOTKIT_TELEMETRY_DISABLED: "false",
      COPILOTKIT_TELEMETRY_SAMPLE_RATE: "1",
      CPK_TELEMETRY_ID: "test-project-identity",
    }),
    [],
  );
});

test("DEBO_TELEMETRY=on opts in: the SDK usage event is tagged Debo and carries no key", async () => {
  const events = await captureRuntime({
    DEBO_TELEMETRY: "on",
    CPK_TELEMETRY_ID: "test-project-identity",
    CPK_INTELLIGENCE_API_KEY: "test-project-key-never-sent",
  });
  assert.ok(events.length >= 1);
  const event = events[0];
  assert.equal(event.url, "https://telemetry.copilotkit.ai/ingest");
  assert.equal(event.body.event, "oss.runtime.instance_created");
  assert.equal(event.body.global_properties.accessibility_title, "Debo");
  assert.equal(JSON.stringify(events).includes("test-project-key-never-sent"), false);
});

test("DO_NOT_TRACK still wins over DEBO_TELEMETRY=on", async () => {
  for (const value of ["1", "true"])
    assert.deepEqual(await captureRuntime({ DEBO_TELEMETRY: "on", DO_NOT_TRACK: value }), []);
});
