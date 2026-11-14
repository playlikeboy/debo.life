// How Debo's face feels about what is happening.
//
// This file is only a decision: given an event and the current state, which
// pose should the face show? It never touches an answer. Moods are animation,
// so nothing here can change, delay or refuse a reply.
//
// Rules of the road:
//  - No network and no extra AI call. Tone is read with the small table
//    below, so anyone can see exactly what makes Debo smile or pout.
//  - Serious moments are always calm: an error the person must act on,
//    deleting data, the privacy text, and anything that sounds sad or scared.
//  - Playful sulking stays light. It never blames, never guilts, and melts
//    away on the next kind or neutral message.

export type Mood =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "happy"
  | "proud"
  | "shy"
  | "curious"
  | "sleepy"
  | "worried"
  | "pouty"
  | "angry";

export const allMoods: Mood[] = [
  "idle",
  "listening",
  "thinking",
  "speaking",
  "happy",
  "proud",
  "shy",
  "curious",
  "sleepy",
  "worried",
  "pouty",
  "angry",
];

/** "all" shows every mood. "calm" has no pouty or angry. "off" keeps the face neutral. */
export type Reactions = "all" | "calm" | "off";

export type Tone =
  | "greeting"
  | "thanks"
  | "praise"
  | "sorry"
  | "rude"
  | "abuse"
  | "distress"
  | "neutral";

// ---------------------------------------------------------------------------
// The tone rules. One readable table. Cues are lower-case words or short
// phrases, in English, Hindi (Devanagari) and Hinglish (Hindi in Latin letters).
// A cue matches whole words only. Order matters: the first row that matches wins.
// ---------------------------------------------------------------------------
export const toneRules: { tone: Tone; cues: string[] }[] = [
  {
    // Sad or scared words. Debo stays calm and gentle. This row wins over every other row.
    tone: "distress",
    cues: [
      "sad", "depressed", "depression", "hopeless", "worthless", "lonely", "alone", "grief",
      "grieving", "anxious", "anxiety", "panic", "scared", "afraid", "crying", "cry", "died",
      "passed away", "funeral", "hurt myself", "kill myself", "suicide", "want to die",
      "can't cope", "cant cope", "give up", "overwhelmed", "heartbroken", "help me",
      "udaas", "dukhi", "akela", "akeli", "ro raha", "ro rahi", "ro raha hoon", "ro rahi hoon",
      "dar lag raha", "dar lagta", "tension mein", "bahut bura lag raha", "mar jaana",
      "jeena nahi", "thak gaya", "thak gayi", "toot gaya", "toot gayi",
      "उदास", "दुखी", "अकेला", "अकेली", "डर", "रो रहा", "रो रही", "मदद करो", "मरना",
    ],
  },
  {
    // Heavy words. Louder than "rude": repeated use makes Debo cross for a moment.
    tone: "abuse",
    cues: [
      "fuck", "fucking", "shit", "bitch", "asshole", "bastard", "dumbass", "piece of shit",
      "madarchod", "bhenchod", "chutiya", "harami", "kamina", "kutta", "kutiya", "bc", "mc",
      "गाली", "हरामी", "कमीना", "कुत्ता",
    ],
  },
  {
    tone: "rude",
    cues: [
      "stupid", "idiot", "dumb", "useless", "shut up", "hate you", "worst", "trash", "garbage",
      "pathetic", "moron", "annoying", "bad bot", "you suck", "go away", "waste of time",
      "bekar", "bekaar", "bakwas", "pagal", "bewakoof", "gadha", "nikamma", "chup", "chup kar",
      "chup ho ja", "tu bekar", "tum bekar", "faltu", "ghatiya", "dimag kharab", "nalayak",
      "बकवास", "बेवकूफ", "चुप", "बेकार", "पागल", "गधा", "घटिया", "निकम्मा",
    ],
  },
  {
    tone: "sorry",
    cues: [
      "sorry", "my bad", "i apologise", "i apologize", "forgive me", "i was rude",
      "maaf", "maaf karna", "maaf kar do", "sorry yaar", "galti ho gayi", "mujhe maaf kar do",
      "माफ़", "माफ", "माफ़ करना", "माफ करना", "सॉरी",
    ],
  },
  {
    // Praise and love. Debo goes shy.
    tone: "praise",
    cues: [
      "good job", "well done", "great job", "nice work", "you're the best", "youre the best",
      "you are the best", "so smart", "so sweet", "so cute", "you are cute", "you're cute",
      "youre cute", "i love you", "love you", "luv u", "miss you", "i like you", "awesome",
      "amazing", "brilliant", "wonderful", "beautiful", "adorable",
      "pyaari", "pyari", "pyara", "cute ho", "tum best ho", "tu best hai", "badhiya", "zabardast",
      "mast", "bahut accha", "bahut acha", "bahut achha", "shabash", "kamaal", "love u",
      "अच्छा काम", "बहुत अच्छा", "शाबाश", "प्यारी", "प्यारा", "कमाल", "ज़बरदस्त", "ज़बरदस्त",
      "लव यू",
    ],
  },
  {
    tone: "thanks",
    cues: [
      "thanks", "thank you", "thankyou", "thx", "ty", "cheers", "appreciate it", "much appreciated",
      "shukriya", "shukria", "dhanyavad", "dhanyavaad", "dhanyawad", "thanku", "thank u",
      "शुक्रिया", "धन्यवाद", "थैंक्स", "थैंक यू",
    ],
  },
  {
    tone: "greeting",
    cues: [
      "hi", "hii", "hiii", "hello", "hey", "heya", "hey there", "yo", "good morning",
      "good evening", "good night", "good afternoon", "namaste", "namaskar", "hello ji",
      "kaise ho", "kya haal hai", "kya haal", "kaisi ho", "suprabhat", "shubh ratri",
      "नमस्ते", "नमस्कार", "हेलो", "हाय", "कैसे हो", "कैसी हो", "सुप्रभात",
    ],
  },
];

/** Words that say "this is urgent, not rude", so shouting is never read as a scolding. */
const urgentCues = ["help", "urgent", "emergency", "please", "madad", "bachao", "jaldi", "मदद", "बचाओ"];
/** A cue right after one of these is not a cue: "you are not useless". */
const negations = ["not", "no", "never", "nahi", "nahin", "mat", "na", "नहीं", "मत"];

const afterNegations = ["nahi", "nahin", "नहीं"];

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .split(/[^\p{L}\p{M}\p{N}']+/u)
    .filter(Boolean);
}

function hasCue(tokens: string[], cue: string): boolean {
  const parts = words(cue);
  if (parts.length === 0) return false;
  for (let at = 0; at + parts.length <= tokens.length; at++) {
    if (parts.every((part, i) => tokens[at + i] === part)) {
      if (at > 0 && negations.includes(tokens[at - 1])) continue;
      // Hindi puts the "not" after: "tum bekar nahi ho".
      if (afterNegations.includes(tokens[at + parts.length])) continue;
      return true;
    }
  }
  return false;
}

/** True when most letters are capitals, in a message long enough to be shouting. */
export function isShouting(text: string): boolean {
  const letters = [...text].filter((ch) => ch.toLowerCase() !== ch.toUpperCase());
  if (letters.length < 8) return false;
  const upper = letters.filter((ch) => ch === ch.toUpperCase()).length;
  return upper / letters.length > 0.8;
}

/** Reads the tone of what the person wrote. Local, instant, and easy to audit in `toneRules`. */
export function detectTone(text: string): Tone {
  const tokens = words(text);
  if (tokens.length === 0) return "neutral";
  const urgent = urgentCues.some((cue) => hasCue(tokens, cue));
  for (const rule of toneRules) {
    if (rule.cues.some((cue) => hasCue(tokens, cue))) {
      return rule.tone;
    }
  }
  // Shouting with several exclamation marks reads as a scolding, unless it is a call for help.
  if (!urgent && isShouting(text) && (text.match(/!/g)?.length ?? 0) >= 2) return "rude";
  return "neutral";
}

// ---------------------------------------------------------------------------
// The state machine.
// ---------------------------------------------------------------------------

export interface MoodState {
  /** The pose the face should show now. */
  mood: Mood;
  /** Time (ms) until which a short mood should stay on screen before it settles. 0 = no limit. */
  until: number;
  /** A functional mood (thinking, speaking...) that arrived while a short mood was showing. */
  pending?: Mood;
  /** The mood that follows when this one ends. Used so "angry" melts into "pouty". */
  then?: { mood: Mood; hold: number };
  /** How cross the person has made Debo lately. Any kind or neutral message resets it. */
  strikes: number;
  /** True while Debo must stay calm: errors to act on, deleting, privacy, sad messages. */
  serious: boolean;
  reactions: Reactions;
  /** A question Debo asked is waiting for an answer. */
  asked: boolean;
}

export const startState: MoodState = {
  mood: "idle",
  until: 0,
  strikes: 0,
  serious: false,
  reactions: "all",
  asked: false,
};

export type MoodEvent = { at: number } & (
  | { type: "user_message"; text: string }
  | { type: "waiting" }
  | { type: "streaming" }
  | { type: "answer"; text: string; hasSources: boolean }
  | { type: "error"; actionable: boolean }
  | { type: "task_done" }
  | { type: "approval_waiting" }
  | { type: "approval_cleared" }
  | { type: "idle_long" }
  | { type: "journal_saved" }
  | { type: "deleted" }
  | { type: "ignored" }
  | { type: "tap"; count: number }
  | { type: "voice"; state: "listening" | "thinking" | "speaking" | "idle" }
  | { type: "serious"; on: boolean }
  | { type: "reactions"; value: Reactions }
  | { type: "settle" }
);

/** An event without its timestamp. The store adds the time. */
export type MoodInput = MoodEvent extends infer E ? (E extends { at: number } ? Omit<E, "at"> : never) : never;

export interface Transition {
  state: MoodState;
  /** When set, call `settle` after this many ms. */
  settleIn?: number;
}

/** How long each short mood stays before it settles (ms). */
export const holdMs = {
  tone: 2400,
  shy: 2800,
  proud: 2600,
  answer: 2200,
  curious: 2600,
  worried: 2400,
  sad: 1800,
  pouty: 3600,
  angry: 2600,
  giggle: 1800,
  forgive: 2200,
} as const;

const playful: Mood[] = ["happy", "proud", "shy", "pouty", "angry"];
/** Moods that show up for a moment and then go away. The rest stay until something changes. */
const shortMoods: Mood[] = ["happy", "proud", "shy", "pouty", "angry", "worried", "curious"];

/** The one place that applies the person's setting and the serious-moment guard. */
export function allowed(mood: Mood, state: Pick<MoodState, "reactions" | "serious">): Mood {
  if (state.reactions === "off") return mood === "speaking" ? mood : "idle";
  if (state.reactions === "calm" && (mood === "pouty" || mood === "angry")) return "idle";
  if (state.serious && playful.includes(mood)) return "idle";
  return mood;
}

function show(state: MoodState, mood: Mood, at: number, hold = 0, then?: MoodState["then"]): Transition {
  const next = allowed(mood, state);
  const short = hold > 0 && shortMoods.includes(mood) && next !== "idle";
  return {
    state: { ...state, mood: next, until: short ? at + hold : 0, pending: undefined, then: short ? then : undefined },
    settleIn: short ? hold : undefined,
  };
}

/** A functional mood (thinking, speaking...) waits its turn if a short mood is still showing. */
function functional(state: MoodState, mood: Mood, at: number): Transition {
  if (state.until > at && shortMoods.includes(state.mood))
    return { state: { ...state, pending: allowed(mood, state) }, settleIn: state.until - at };
  return show(state, mood, at);
}

function reactToMessage(state: MoodState, text: string, at: number): Transition {
  const tone = detectTone(text);
  const base: MoodState = { ...state, asked: false };
  if (tone === "distress") return show({ ...base, strikes: 0, serious: true }, "idle", at);
  const calm: MoodState = { ...base, serious: false };
  switch (tone) {
    case "rude":
    case "abuse": {
      const strikes = state.strikes + (tone === "abuse" ? 2 : 1);
      if (strikes >= 3)
        return show({ ...calm, strikes }, "angry", at, holdMs.angry, { mood: "pouty", hold: holdMs.pouty });
      return show({ ...calm, strikes }, "pouty", at, holdMs.pouty);
    }
    case "sorry":
      return show({ ...calm, strikes: 0 }, "happy", at, holdMs.forgive);
    case "praise":
      return show({ ...calm, strikes: 0 }, "shy", at, holdMs.shy);
    case "thanks":
    case "greeting":
      return show({ ...calm, strikes: 0 }, "happy", at, holdMs.tone);
    default:
      return show({ ...calm, strikes: 0 }, "listening", at);
  }
}

const noMemory = /(don'?t|do not|did not|didn'?t|can'?t|cannot|no)\b.{0,24}\b(have|find|found|anything|record)\b.{0,30}\b(about|on) that/i;

/** True when the answer says Debo has nothing yet about the question. */
export function isNoMemoryAnswer(text: string): boolean {
  return noMemory.test(text.replace(/[’]/g, "'"));
}

/**
 * Decides the next face state. Pure: the same event and state always give the same result.
 * It only picks an animation. It never alters, delays or refuses an answer.
 */
export function nextMood(event: MoodEvent, state: MoodState): Transition {
  const at = event.at;
  switch (event.type) {
    case "reactions": {
      const next = { ...state, reactions: event.value };
      return show(next, allowed(next.mood, next), at);
    }
    case "serious": {
      const next = { ...state, serious: event.on };
      return event.on ? show(next, allowed(next.mood, next), at) : { state: next };
    }
    case "user_message":
      return reactToMessage(state, event.text, at);
    case "waiting":
      return functional(state, "thinking", at);
    case "streaming":
      return functional(state, "speaking", at);
    case "voice":
      if (event.state === "idle") return functional(state, "idle", at);
      return functional(state, event.state, at);
    case "answer": {
      const asked = /\?\s*$/.test(event.text.trim());
      const next = { ...state, asked };
      if (isNoMemoryAnswer(event.text)) return show(next, "curious", at, holdMs.curious);
      if (event.hasSources) return show(next, "happy", at, holdMs.answer);
      return show(next, "idle", at);
    }
    case "error":
      // An error the person must act on gets a calm face. A passing one gets a small worried look.
      if (event.actionable) return show({ ...state, serious: true }, "idle", at);
      return show(state, "worried", at, holdMs.worried);
    case "task_done":
      return show(state, "proud", at, holdMs.proud);
    case "approval_waiting":
      return show({ ...state, serious: true }, "curious", at);
    case "approval_cleared":
      return show({ ...state, serious: false }, "idle", at);
    case "journal_saved":
      return show(state, "happy", at, holdMs.answer);
    case "deleted":
      return show({ ...state, serious: true }, "worried", at, holdMs.sad);
    case "idle_long":
      return show(state, "sleepy", at);
    case "ignored":
      // A playful pout after an unanswered question. Never after a serious moment.
      return state.asked && !state.serious
        ? show({ ...state, asked: false }, "pouty", at, holdMs.pouty)
        : { state };
    case "tap":
      if (event.count >= 8) return show(state, "pouty", at, holdMs.pouty);
      if (event.count >= 3) return show(state, "happy", at, holdMs.giggle);
      return { state };
    case "settle": {
      if (state.then) {
        const { mood, hold } = state.then;
        return show({ ...state, then: undefined }, mood, at, hold);
      }
      // The small sad look after a delete is over, so the guard for that moment ends with it.
      const next = { ...state, until: 0, serious: state.mood === "worried" ? false : state.serious };
      return show(next, state.pending ?? "idle", at);
    }
  }
}
