import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  accessKeyFromEnv,
  browserWorkerUrl,
  type Config,
  defaultDataDir,
  readConfig,
  shadowedEnvKeys,
  telemetryOptedIn,
} from "../apps/server/src/config.ts";

const sampleConfig: Config = {
  mode: "sample",
  port: 8787,
  host: "127.0.0.1",
  publicUrl: "http://localhost:8787",
  dataDir: ".openfuse",
  agentBackend: "sample",
  googleRedirectUri: "http://localhost:8787/api/google/callback",
  allowedOrigins: ["http://localhost:8081"],
};

test("no Intelligence key is needed to read config in sample or live mode", (t) => {
  const previous = { ...process.env };
  t.after(() => {
    process.env = previous;
  });
  delete process.env.CPK_INTELLIGENCE_API_KEY;
  process.env.HOST = "127.0.0.1";
  process.env.WORKSPACE_MODE = "sample";
  assert.equal(readConfig().mode, "sample");
  process.env.WORKSPACE_MODE = "live";
  process.env.OPENFUSE_ACCESS_KEY = "a".repeat(32);
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
  assert.equal(readConfig().mode, "live");
  assert.equal("intelligenceApiKey" in readConfig(), false);
});

test("telemetry is opt-in: only DEBO_TELEMETRY on, true or 1 counts", () => {
  for (const value of ["on", "ON", "true", "1", " on "])
    assert.equal(telemetryOptedIn({ DEBO_TELEMETRY: value }), true, value);
  for (const value of [undefined, "", "off", "false", "0", "yes", "enabled"])
    assert.equal(telemetryOptedIn({ DEBO_TELEMETRY: value }), false, String(value));
  // The old CopilotKit variables never opt anyone in.
  assert.equal(telemetryOptedIn({ CPK_TELEMETRY_ID: "x" }), false);
});

test("web search is enabled by default with an explicit opt-out", (t) => {
  const previous = { ...process.env };
  t.after(() => {
    process.env = previous;
  });
  process.env.WORKSPACE_MODE = "sample";
  process.env.AGENT_BACKEND = "model";
  process.env.HOST = "127.0.0.1";
  delete process.env.WEB_SEARCH_ENABLED;
  assert.equal(readConfig().webSearchEnabled, true);
  for (const value of ["true", "", "1", "TRUE"]) {
    process.env.WEB_SEARCH_ENABLED = value;
    assert.equal(readConfig().webSearchEnabled, true);
  }
  process.env.WEB_SEARCH_ENABLED = "false";
  assert.equal(readConfig().webSearchEnabled, false);
});

test("Jev mode is off by default and validates explicit modes", async () => {
  const { readConfig } = await import("../apps/server/src/config.ts");
  const old = {
    JEV_MODE: process.env.JEV_MODE,
    TYPESAFE_API_KEY: process.env.TYPESAFE_API_KEY,
  };
  try {
      delete process.env.JEV_MODE;
    assert.equal(readConfig().jevMode, "off");
    process.env.JEV_MODE = "sample";
    assert.equal(readConfig().jevMode, "sample");
    process.env.JEV_MODE = "live";
    delete process.env.TYPESAFE_API_KEY;
    assert.throws(() => readConfig(), /TYPESAFE_API_KEY/);
    process.env.TYPESAFE_API_KEY = "fixture-key";
    assert.equal(readConfig().typesafeApiKey, "fixture-key");
    process.env.JEV_MODE = "invalid";
    assert.throws(() => readConfig(), /JEV_MODE/);
  } finally {
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("browser worker URL keeps an existing scheme and adds http to host:port", () => {
  assert.equal(browserWorkerUrl(undefined), undefined);
  assert.equal(browserWorkerUrl("  "), undefined);
  assert.equal(browserWorkerUrl("http://127.0.0.1:8790"), "http://127.0.0.1:8790");
  assert.equal(browserWorkerUrl("https://browser.internal:8790"), "https://browser.internal:8790");
  assert.equal(browserWorkerUrl("openfuse-browser-h4fx:8790"), "http://openfuse-browser-h4fx:8790");
});

test("environment variables that override a different .env value are reported by name", () => {
  const file = { OPENAI_API_KEY: "sk-or-file", MODEL: "openai/gpt-5", PORT: "8787", EMPTY: "" };
  const env = { OPENAI_API_KEY: "sk-proj-system", MODEL: "openai/gpt-5", EMPTY: "set" };
  assert.deepEqual(shadowedEnvKeys(file, env), ["OPENAI_API_KEY", "EMPTY"]);
  assert.deepEqual(shadowedEnvKeys(file, {}), []);
});

test("computer provider defaults to Docker and e2b-desktop requires a server-side key", async () => {
  const { readConfig } = await import("../apps/server/src/config.ts");
  const keys = [
    "COMPUTER_PROVIDER",
    "COMPUTER_ENABLED",
    "E2B_API_KEY",
    "COMPUTER_E2B_TEMPLATE",
    "COMPUTER_DEPLOYMENT_ID",
  ];
  const old = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
      for (const key of keys.slice(0, 5)) delete process.env[key];
    assert.equal(readConfig().computerProvider, "docker");
    process.env.COMPUTER_DEPLOYMENT_ID = " ";
    assert.equal(readConfig().computerDeploymentId, undefined);
    delete process.env.COMPUTER_DEPLOYMENT_ID;
    process.env.COMPUTER_PROVIDER = "k8s";
    assert.throws(() => readConfig(), /COMPUTER_PROVIDER/);
    process.env.COMPUTER_PROVIDER = "e2b-desktop";
    process.env.COMPUTER_ENABLED = "true";
    process.env.E2B_API_KEY = " ";
    assert.throws(() => readConfig(), /E2B_API_KEY/);
    process.env.E2B_API_KEY = "fixture-key";
    // A team-wide sandbox namespace needs an explicit, unique deployment id.
    assert.throws(() => readConfig(), /COMPUTER_DEPLOYMENT_ID/);
    process.env.COMPUTER_DEPLOYMENT_ID = "fixture-deployment";
    const config = readConfig();
    assert.equal(config.computerProvider, "e2b-desktop");
    assert.equal(config.computerE2bTemplate, "desktop");
    assert.equal(config.e2bApiKey, "fixture-key");
  } finally {
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("installs from before the rename keep their access key and data directory", async (t) => {
  const key = "k".repeat(24);
  assert.equal(accessKeyFromEnv({ OPENFUSE_ACCESS_KEY: key }), key);
  assert.equal(accessKeyFromEnv({ OPENFUSE_ACCESS_KEY: key, OPENMUSE_ACCESS_KEY: "old" }), key);
  // Legacy names, kept so existing installs keep working.
  assert.equal(accessKeyFromEnv({ OPENMUSE_ACCESS_KEY: key }), key);
  assert.equal(accessKeyFromEnv({ OPENFUSE_ACCESS_KEY: "", OPENMUSE_ACCESS_KEY: key }), key);
  assert.equal(accessKeyFromEnv({}), undefined);

  const root = await mkdtemp(join(tmpdir(), "openfuse-data-dir-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  assert.equal(defaultDataDir(root), ".openfuse");
  await mkdir(join(root, ".openmuse"));
  assert.equal(defaultDataDir(root), ".openmuse");
  await mkdir(join(root, ".openfuse"));
  assert.equal(defaultDataDir(root), ".openfuse");
});
