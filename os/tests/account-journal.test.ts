import assert from "node:assert/strict";
import { test } from "node:test";
import { DeboService } from "../apps/server/src/debo/index.ts";
import { ALICE, BOB, fakeBackend } from "./helpers/debo.ts";

// "Download my data" and "Delete my data" must cover the journal too, not only the
// workspace rows, and must never touch another person's journal.

test("the journal service exports and deletes only the caller's entries", async () => {
  const backend = fakeBackend();
  const service = new DeboService(backend);
  await backend.entries.create(ALICE, "Alice wrote about the sea");
  await backend.entries.create(ALICE, "Alice wrote about her dentist");
  await backend.entries.create(BOB, "Bob wrote about his boat");

  const exported = await service.exportMine(ALICE);
  assert.equal(exported?.entries.length, 2);
  assert.equal(JSON.stringify(exported).includes("boat"), false);

  assert.equal(await service.deleteMine(ALICE), 2);
  assert.equal(backend.entriesOf(ALICE).length, 0);
  assert.equal(backend.entriesOf(BOB).length, 1);
});

test("with no journal set up, export is empty and delete removes nothing", async () => {
  assert.equal(await new DeboService(null).exportMine(ALICE), null);
  assert.equal(await new DeboService(null).deleteMine(ALICE), 0);
  // A name that is not a Debo account has no journal either.
  const service = new DeboService(fakeBackend());
  assert.equal(await service.exportMine("local-user"), null);
  assert.equal(await service.deleteMine("local-user"), 0);
});
