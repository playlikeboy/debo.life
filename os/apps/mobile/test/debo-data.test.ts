import assert from "node:assert/strict";
import test from "node:test";
import {
  DRAFT_KEY,
  describeActivity,
  entryFocus,
  entryDay,
  loadDraft,
  preview,
  readDeboTool,
  saveDraft,
} from "../src/debo-data.ts";

const chip = { id: "11111111-1111-4111-8111-111111111111", label: "Journal, 14 March" };

test("an answer shows its sources once each", () => {
  const view = readDeboTool(
    "ask_my_life",
    JSON.stringify({ status: "answered", answer: "You walked with Arun.", sources: [chip, chip] }),
  );
  assert.deepEqual(view, { kind: "answer", answer: "You walked with Arun.", sources: [chip] });
});

test("an unknown answer shows no sources and the plain message", () => {
  const view = readDeboTool("ask_my_life", {
    status: "unknown",
    message: "I don’t have anything about that yet. Write an entry about it, then ask again.",
  });
  assert.equal(view.kind, "nothing");
  assert.match(view.kind === "nothing" ? view.message : "", /I don’t have anything about that yet/);
});

test("errors from the server are shown as they are, in plain words", () => {
  assert.deepEqual(readDeboTool("ask_my_life", { error: "Your journal is not set up on this server yet." }), {
    kind: "error",
    message: "Your journal is not set up on this server yet.",
  });
});

test("search results keep each entry's chip and date", () => {
  const view = readDeboTool("search_my_journal", {
    matches: [{ source: chip, title: "Walk", date: "2026-03-14", excerpt: "Walked with Arun" }],
  });
  assert.equal(view.kind, "matches");
  if (view.kind === "matches") {
    assert.deepEqual(view.sources, [chip]);
    assert.equal(view.excerpts[0]?.excerpt, "Walked with Arun");
  }
  assert.equal(readDeboTool("search_my_journal", { matches: [] }).kind, "nothing");
});

test("a prepared entry is a review, not a saved entry", () => {
  const view = readDeboTool("add_journal_entry", {
    status: "awaiting_review",
    actionId: "abc",
    title: "Add to your journal",
    preview: "Started piano",
  });
  assert.deepEqual(view, { kind: "review", actionId: "abc", preview: "Started piano" });
});

test("garbage never throws", () => {
  for (const name of ["ask_my_life", "search_my_journal", "add_journal_entry", "other"])
    for (const raw of [undefined, null, 5, "not json", "{}", []])
      assert.doesNotThrow(() => readDeboTool(name, raw));
  assert.equal(readDeboTool("ask_my_life", "not json").kind, "unreadable");
});

test("activity lines are plain and never carry content", () => {
  assert.equal(describeActivity({ action: "saved", sourceIds: ["a"] }), "You saved an entry.");
  assert.equal(describeActivity({ action: "answered", sourceIds: ["a", "b"] }), "Debo answered a question using 2 entries.");
  assert.equal(describeActivity({ action: "forgot-memory", sourceIds: [] }), "You asked Debo to forget a memory.");
});

test("dates read the same as the source chips (UTC, day first)", () => {
  assert.equal(entryDay("2026-03-14T23:30:00Z"), "Saturday 14 March");
  assert.equal(entryDay("nope"), "");
  assert.equal(preview("a\n\n  b   c", 140), "a b c");
  assert.equal(preview("x".repeat(200), 10), `${"x".repeat(9)}…`);
});

test("a draft is kept on this device and cleared when empty", () => {
  const data = new Map<string, string>();
  const store = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
  saveDraft("half a thought", store);
  assert.equal(data.get(DRAFT_KEY), "half a thought");
  assert.equal(loadDraft(store), "half a thought");
  saveDraft("", store);
  assert.equal(data.has(DRAFT_KEY), false);
});

test("a draft survives blocked storage", () => {
  const blocked = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  };
  saveDraft("still here", blocked);
  assert.equal(loadDraft(blocked), "still here");
  saveDraft("", blocked);
});

test("opening an entry from a chip tells the journal which one", () => {
  const seen: (string | undefined)[] = [];
  const stop = entryFocus.subscribe((id) => seen.push(id));
  entryFocus.set(chip.id);
  assert.equal(entryFocus.get(), chip.id);
  entryFocus.set(undefined);
  stop();
  entryFocus.set("ignored");
  assert.deepEqual(seen, [chip.id, undefined]);
  entryFocus.set(undefined);
});
