import assert from "node:assert/strict";
import test from "node:test";
import { clamp01, rmsLevel, smoothLevel } from "../src/audio-level.ts";
import {
  allMoods,
  allowed,
  detectTone,
  isNoMemoryAnswer,
  type Mood,
  type MoodEvent,
  type MoodInput,
  type MoodState,
  nextMood,
  type Reactions,
  startState,
} from "../src/debo-mood.ts";

let clock = 1000;
type Ev = MoodInput;
/** Runs events in order, 10 seconds apart, and returns the final state. */
function run(events: Ev[], from: MoodState = startState, gap = 10_000): MoodState {
  let state = from;
  for (const event of events) {
    clock += gap;
    state = nextMood({ ...event, at: clock } as MoodEvent, state).state;
  }
  return state;
}
function say(text: string, from: MoodState = startState) {
  return run([{ type: "user_message", text }], from);
}
const withSetting = (reactions: Reactions): MoodState => ({ ...startState, reactions });

test("a plain message makes her listen, waiting makes her think, streaming makes her speak", () => {
  let s = say("what did I write on Monday");
  assert.equal(s.mood, "listening");
  s = run([{ type: "waiting" }], s);
  assert.equal(s.mood, "thinking");
  s = run([{ type: "streaming" }], s);
  assert.equal(s.mood, "speaking");
});

test("an answer with sources is happy; one without stays neutral", () => {
  assert.equal(run([{ type: "answer", text: "You wrote about Goa.", hasSources: true }]).mood, "happy");
  assert.equal(run([{ type: "answer", text: "Hello.", hasSources: false }]).mood, "idle");
});

test("'I don't have anything about that yet' looks curious", () => {
  assert.ok(isNoMemoryAnswer("I don't have anything about that yet."));
  assert.ok(isNoMemoryAnswer("Sorry, I do not have anything about that yet"));
  assert.ok(!isNoMemoryAnswer("You wrote about Goa."));
  assert.equal(
    run([{ type: "answer", text: "I don't have anything about that yet.", hasSources: false }]).mood,
    "curious",
  );
});

test("errors: a passing one is worried, one the person must act on is calm", () => {
  assert.equal(run([{ type: "error", actionable: false }]).mood, "worried");
  const calm = run([{ type: "error", actionable: true }]);
  assert.equal(calm.mood, "idle");
  assert.ok(calm.serious);
});

test("task done is proud, risky action is curious and attentive, then clears", () => {
  assert.equal(run([{ type: "task_done" }]).mood, "proud");
  let s = run([{ type: "approval_waiting" }]);
  assert.equal(s.mood, "curious");
  assert.equal(s.until, 0, "it stays while the approval waits");
  s = run([{ type: "approval_cleared" }], s);
  assert.equal(s.mood, "idle");
  assert.ok(!s.serious);
});

test("a long quiet makes her sleepy, and any message wakes her", () => {
  const s = run([{ type: "idle_long" }]);
  assert.equal(s.mood, "sleepy");
  assert.equal(say("hello", s).mood, "happy");
  assert.equal(say("what is on today", s).mood, "listening");
});

test("a saved journal entry is happy; a delete is a small worried look that then ends", () => {
  assert.equal(run([{ type: "journal_saved" }]).mood, "happy");
  const t = nextMood({ type: "deleted", at: 5000 }, startState);
  assert.equal(t.state.mood, "worried");
  assert.ok(t.settleIn && t.settleIn < 3000);
  const after = nextMood({ type: "settle", at: 7000 }, t.state).state;
  assert.equal(after.mood, "idle");
  assert.ok(!after.serious, "the delete guard ends with the look");
});

test("greeting, thanks, praise and affection (English, Hindi, Hinglish)", () => {
  for (const hi of ["hi debo", "Hello!", "namaste", "नमस्ते", "kaise ho", "good morning"])
    assert.equal(say(hi).mood, "happy", hi);
  for (const thanks of ["thanks a lot", "thank you", "shukriya", "धन्यवाद", "dhanyavaad debo"])
    assert.equal(say(thanks).mood, "happy", thanks);
  for (const praise of [
    "you are so cute",
    "i love you",
    "good job",
    "tum best ho",
    "bahut accha",
    "बहुत अच्छा",
    "shabash",
    "so smart",
  ])
    assert.equal(say(praise).mood, "shy", praise);
});

test("tone detection table", () => {
  assert.equal(detectTone("what is on my calendar"), "neutral");
  assert.equal(detectTone("you are stupid"), "rude");
  assert.equal(detectTone("tu bekar hai"), "rude");
  assert.equal(detectTone("चुप रहो"), "rude");
  assert.equal(detectTone("what the fuck"), "abuse");
  assert.equal(detectTone("sorry yaar"), "sorry");
  assert.equal(detectTone("माफ़ करना"), "sorry");
  assert.equal(detectTone(""), "neutral");
});

test("negation: 'you are not useless' is not rude", () => {
  assert.equal(detectTone("you are not useless"), "neutral");
  assert.equal(say("tum bekar nahi ho").mood, "listening");
});

test("shouting at Debo is a pout; shouting for help is not", () => {
  assert.equal(detectTone("WHY DON'T YOU WORK!!!"), "rude");
  assert.equal(say("WHY DON'T YOU WORK!!!").mood, "pouty");
  assert.equal(detectTone("HELP I NEED THIS NOW!!!"), "neutral", "a call for help is not a scolding");
  assert.equal(detectTone("PLEASE ANSWER ME NOW!!!"), "neutral");
  assert.equal(detectTone("WHAT DID I WRITE"), "neutral", "capitals alone are not rude");
});

test("rude words make a playful pout first", () => {
  const s = say("you are useless");
  assert.equal(s.mood, "pouty");
  assert.equal(s.strikes, 1);
});

test("repeated or strong abuse makes her briefly angry, then pouty, then she recovers", () => {
  let s = say("you are stupid");
  s = say("useless bot", s);
  assert.equal(s.mood, "pouty");
  s = say("idiot", s);
  assert.equal(s.mood, "angry");
  const t = nextMood({ type: "settle", at: clock + 3000 }, s);
  assert.equal(t.state.mood, "pouty", "angry melts into a pout");
  assert.ok(t.settleIn);
  const melted = nextMood({ type: "settle", at: clock + 9000 }, t.state);
  assert.equal(melted.state.mood, "happy", "the pout melts into a smile");
  const done = nextMood({ type: "settle", at: clock + 12000 }, melted.state).state;
  assert.equal(done.mood, "idle");

  // One strong word counts double, so two of them reach angry.
  assert.equal(say("you bitch").mood, "pouty");
  assert.equal(say("you bastard", say("you bitch")).mood, "angry");
});

test("a kind or neutral message after anger clears it", () => {
  let s = say("fuck you");
  s = say("fuck off", s);
  assert.equal(s.mood, "angry");
  const neutral = say("what is on my calendar", s);
  assert.equal(neutral.strikes, 0);
  assert.equal(neutral.mood, "listening");
  assert.equal(say("you are stupid", neutral).mood, "pouty", "the count starts again");
});

test("'sorry' forgives at once", () => {
  let s = say("you idiot");
  s = say("stupid", s);
  s = say("sorry", s);
  assert.equal(s.mood, "happy");
  assert.equal(s.strikes, 0);
  assert.equal(say("maaf karna", say("bakwas")).mood, "happy");
});

test("being ignored after she asked a question is a playful pout, once", () => {
  let s = run([{ type: "answer", text: "Want me to read it out?", hasSources: false }]);
  assert.ok(s.asked);
  s = run([{ type: "ignored" }], s);
  assert.equal(s.mood, "pouty");
  const melted = run([{ type: "settle" }], s);
  assert.equal(melted.mood, "happy", "she melts back to happy");
  const again = run([{ type: "ignored" }], melted);
  assert.notEqual(again.mood, "pouty", "no second pout for the same question");
  s = run([{ type: "answer", text: "Done.", hasSources: false }]);
  assert.equal(run([{ type: "ignored" }], s).mood, "idle", "no question, no pout");
  s = run([{ type: "answer", text: "Want me to read it out?", hasSources: false }]);
  s = say("yes please", s);
  assert.ok(!s.asked, "a reply clears the question");
});

test("taps: one is nothing for the mood, a few giggle, many pout", () => {
  assert.equal(run([{ type: "tap", count: 1 }]).mood, "idle");
  assert.equal(run([{ type: "tap", count: 4 }]).mood, "happy");
  assert.equal(run([{ type: "tap", count: 9 }]).mood, "pouty");
  assert.equal(run([{ type: "tap", count: 9 }], withSetting("calm")).mood, "idle");
});

test("voice states map to listening, thinking, speaking", () => {
  assert.equal(run([{ type: "voice", state: "listening" }]).mood, "listening");
  assert.equal(run([{ type: "voice", state: "thinking" }]).mood, "thinking");
  assert.equal(run([{ type: "voice", state: "speaking" }]).mood, "speaking");
  const speaking = run([{ type: "voice", state: "speaking" }]);
  assert.equal(run([{ type: "voice", state: "idle" }], speaking).mood, "idle");
});

test("a short mood is not cut off by thinking; it waits and then thinking shows", () => {
  const happy = nextMood({ type: "user_message", text: "thanks", at: 1000 }, startState);
  const waiting = nextMood({ type: "waiting", at: 1100 }, happy.state);
  assert.equal(waiting.state.mood, "happy");
  assert.equal(waiting.state.pending, "thinking");
  const settled = nextMood({ type: "settle", at: 1000 + (happy.settleIn ?? 0) }, waiting.state);
  assert.equal(settled.state.mood, "thinking");
});

test("serious moments: sad or scared messages keep her calm and gentle", () => {
  for (const text of [
    "I feel so sad today",
    "i am feeling lonely",
    "my dog died",
    "bahut udaas hoon",
    "main akela hoon",
    "मैं बहुत उदास हूँ",
    "I want to die",
    "I'm so anxious about tomorrow",
  ]) {
    assert.equal(detectTone(text), "distress", text);
    const s = say(text);
    assert.equal(s.mood, "idle", text);
    assert.ok(s.serious, text);
  }
  assert.equal(say("I feel so sad and stupid").mood, "idle", "distress wins over rude words");
});

test("serious guard: nothing playful appears while serious", () => {
  const serious = say("I feel hopeless");
  const events: Ev[] = [
    { type: "answer", text: "Here is what I found.", hasSources: true },
    { type: "journal_saved" },
    { type: "task_done" },
    { type: "tap", count: 4 },
    { type: "tap", count: 9 },
    { type: "ignored" },
  ];
  for (const event of events) {
    const mood = run([event], serious).mood;
    assert.ok(!["happy", "proud", "shy", "pouty", "angry"].includes(mood), `${event.type} -> ${mood}`);
  }
  assert.equal(run([{ type: "waiting" }], serious).mood, "thinking");
  assert.equal(run([{ type: "streaming" }], serious).mood, "speaking");
  const privacy = run([{ type: "serious", on: true }], run([{ type: "journal_saved" }]));
  assert.equal(privacy.mood, "idle", "the privacy text turns a smile into calm");
  assert.ok(!say("what is on my calendar", serious).serious, "the next ordinary message ends it");
});

test("allowed(): Calm removes pouty and angry, Off keeps her neutral", () => {
  const calm = { reactions: "calm" as const, serious: false };
  assert.equal(allowed("pouty", calm), "idle");
  assert.equal(allowed("angry", calm), "idle");
  assert.equal(allowed("happy", calm), "happy");
  const off = { reactions: "off" as const, serious: false };
  for (const mood of allMoods) assert.equal(allowed(mood, off), mood === "speaking" ? "speaking" : "idle");
  assert.equal(say("you idiot", withSetting("calm")).mood, "idle");
  assert.equal(say("thanks", withSetting("off")).mood, "idle");
  assert.equal(say("thanks", withSetting("calm")).mood, "happy");
});

test("changing the setting applies at once", () => {
  const s = say("you idiot");
  assert.equal(s.mood, "pouty");
  const off = nextMood({ type: "reactions", value: "off", at: clock }, s).state;
  assert.equal(off.mood, "idle");
});

test("every mood is reachable and nextMood is pure", () => {
  const seen = new Set<Mood>();
  const events: Ev[] = [
    { type: "waiting" },
    { type: "streaming" },
    { type: "task_done" },
    { type: "idle_long" },
    { type: "error", actionable: false },
    { type: "approval_waiting" },
    { type: "user_message", text: "thanks" },
    { type: "user_message", text: "i love you" },
    { type: "user_message", text: "you are stupid" },
    { type: "user_message", text: "what next" },
  ];
  for (const event of events) seen.add(run([event]).mood);
  seen.add(say("fuck you", say("fuck off")).mood);
  seen.add(startState.mood);
  for (const mood of allMoods) assert.ok(seen.has(mood), `${mood} never shown`);
  const a = nextMood({ type: "waiting", at: 5 }, startState);
  const b = nextMood({ type: "waiting", at: 5 }, startState);
  assert.deepEqual(a, b);
});

test("audio level helpers", () => {
  assert.equal(clamp01(2), 1);
  assert.equal(clamp01(-1), 0);
  assert.equal(clamp01(Number.NaN), 0);
  assert.equal(rmsLevel([]), 0);
  assert.equal(rmsLevel([0, 0, 0]), 0);
  assert.equal(rmsLevel([1, -1, 1, -1]), 1);
  assert.equal(rmsLevel([128, 128, 128], true), 0);
  assert.ok(rmsLevel([0.1, -0.1, 0.1, -0.1]) > 0.2);
  const up = smoothLevel(0, 1, 60);
  assert.ok(up > 0.55 && up < 0.7, String(up));
  const down = smoothLevel(1, 0, 60);
  assert.ok(down > 0.7, String(down));
  assert.equal(smoothLevel(0.4, 0.4, 100), 0.4);
  assert.equal(smoothLevel(0.4, 0.9, 0), 0.4);
  let v = 1;
  for (let i = 0; i < 40; i++) v = smoothLevel(v, 0, 50);
  assert.ok(v < 0.01);
});

test("task changes become mood events", async () => {
  const { taskMoodEvents, latestAnswer } = await import("../src/debo-mood-events.ts");
  const first = taskMoodEvents(undefined, [{ id: "a", status: "running" }]);
  assert.deepEqual(first.events, [], "the first look only learns the start");
  const done = taskMoodEvents(first.next, [{ id: "a", status: "succeeded" }]);
  assert.deepEqual(done.events, [{ type: "task_done" }]);
  const wait = taskMoodEvents(done.next, [{ id: "a", status: "waiting_approval" }]);
  assert.deepEqual(wait.events, [{ type: "approval_waiting" }]);
  const clear = taskMoodEvents(wait.next, [{ id: "a", status: "running" }]);
  assert.deepEqual(clear.events, [{ type: "approval_cleared" }]);
  const answer = latestAnswer([
    { role: "user", content: "hi" },
    { role: "assistant", content: "", toolCalls: [{ function: { name: "ask_my_life" } }] },
    { role: "assistant", content: "You wrote about Goa." },
  ]);
  assert.deepEqual(answer, { text: "You wrote about Goa.", hasSources: true });
});
