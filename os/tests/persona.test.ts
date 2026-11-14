import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Hono } from "hono";
import { createStore, type Store } from "../apps/server/src/db.ts";
import { PersonaStore, personaPrompt, personaRoutes } from "../apps/server/src/persona.ts";

let db: Store;
before(async () => {
  db = await createStore();
});
after(async () => {
  await db.close();
});

test("persona: set, read, replace and clear, per person", async () => {
  const store = new PersonaStore(db);
  assert.equal(await store.get("a"), null);
  await store.set("a", { role: "my girlfriend" });
  assert.equal((await store.get("a"))?.role, "my girlfriend");
  assert.equal(await store.get("b"), null);
  await store.set("a", { role: "a study buddy", notes: "calls me champ" });
  assert.equal((await store.get("a"))?.notes, "calls me champ");
  await store.clear("a");
  assert.equal(await store.get("a"), null);
  await assert.rejects(store.set("a", { role: "   " }));
});

test("persona prompt names the role and keeps it data; nothing when off", async () => {
  assert.equal(personaPrompt(null), "");
  const text = personaPrompt({ id: "current", role: "my girlfriend", notes: "", updatedAt: "" });
  assert.match(text, /my girlfriend/);
  assert.match(text, /clear_persona/);
});

test("persona routes read, set and clear for the signed-in person", async () => {
  const app = new Hono<{ Variables: { owner: string } }>();
  app.use("*", async (c, next) => {
    c.set("owner", "route-owner");
    await next();
  });
  app.route("/p", personaRoutes(new PersonaStore(db)));
  const json = { "Content-Type": "application/json" };
  const put = await app.request("/p", { method: "PUT", headers: json, body: JSON.stringify({ role: "a coach" }) });
  assert.equal((await put.json()).persona.role, "a coach");
  assert.equal((await (await app.request("/p")).json()).persona.role, "a coach");
  assert.equal((await (await app.request("/p", { method: "DELETE" })).json()).persona, null);
  assert.equal((await (await app.request("/p")).json()).persona, null);
});
