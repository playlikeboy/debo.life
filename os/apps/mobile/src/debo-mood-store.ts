// The one shared mood store. The header mascot, the chat and the voice popup all
// read the same face from here, so they always agree. It is a tiny external store
// (no library), read with useSyncExternalStore. The decisions live in debo-mood.ts;
// this file only keeps time: short moods settle, long quiet makes her sleepy,
// a question nobody answered gets one playful pout.
//
// Moods are animation only. Nothing here can change, delay or refuse an answer.
import { useSyncExternalStore } from "react";
import { Animated, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { type Mood, type MoodEvent, type MoodInput, type MoodState, nextMood, type Reactions, startState } from "./debo-mood";

export interface MoodSnapshot {
  mood: Mood;
  reactions: Reactions;
}

/** Quietly sleepy after this long with nothing happening. */
const SLEEPY_AFTER_MS = 4 * 60_000;
/** A question nobody answered gets one playful pout after this long. */
const IGNORED_AFTER_MS = 90_000;
/** The face never changes pose more often than this, so nothing flickers. */
const MIN_GAP_MS = 380;
const TAP_WINDOW_MS = 2200;
const REACTIONS_KEY = "debo.reactions";

/** Live audio levels, 0..1. The voice popup writes them; the face and halo read them natively. */
export const deboLevels = {
  /** Debo's voice. */
  debo: new Animated.Value(0),
  /** The person's microphone. */
  you: new Animated.Value(0),
  /** 1 when `debo` carries a real audio level, 0 when the mouth should use its soft loop. */
  real: new Animated.Value(0),
};

class MoodStore {
  private state: MoodState = startState;
  private shown: Mood = "idle";
  private snapshot: MoodSnapshot = { mood: "idle", reactions: "all" };
  private listeners = new Set<() => void>();
  private settleTimer?: ReturnType<typeof setTimeout>;
  private sleepTimer?: ReturnType<typeof setTimeout>;
  private ignoredTimer?: ReturnType<typeof setTimeout>;
  private showTimer?: ReturnType<typeof setTimeout>;
  private lastShown = 0;
  private taps: number[] = [];

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;

  /** Tell the face something happened. Safe to call from anywhere, any time. */
  emit = (event: MoodInput) => {
    const at = Date.now();
    const transition = nextMood({ ...event, at } as MoodEvent, this.state);
    this.state = transition.state;
    clearTimeout(this.settleTimer);
    if (transition.settleIn) this.settleTimer = setTimeout(() => this.emit({ type: "settle" }), transition.settleIn);
    if (event.type === "user_message" || event.type === "voice") clearTimeout(this.ignoredTimer);
    if (event.type === "answer" && this.state.asked) {
      clearTimeout(this.ignoredTimer);
      this.ignoredTimer = setTimeout(() => this.emit({ type: "ignored" }), IGNORED_AFTER_MS);
    }
    if (event.type !== "idle_long") this.restartSleepTimer();
    this.show();
  };

  /** A tap on the face. The face squishes itself; many quick taps make her giggle, then pout. */
  tap = () => {
    const now = Date.now();
    this.taps = [...this.taps.filter((t) => now - t < TAP_WINDOW_MS), now];
    this.emit({ type: "tap", count: this.taps.length });
  };

  setReactions = (value: Reactions, save = true) => {
    this.emit({ type: "reactions", value });
    if (save) void saveReactions(value);
  };

  /** Starts the sleep timer and loads the saved setting. Called once by the app. */
  start() {
    this.restartSleepTimer();
    void loadReactions().then((value) => value && this.setReactions(value, false));
  }

  /** The popup asks for calm while the privacy text is on screen. */
  serious = (on: boolean) => this.emit({ type: "serious", on });

  private restartSleepTimer() {
    clearTimeout(this.sleepTimer);
    this.sleepTimer = setTimeout(() => this.emit({ type: "idle_long" }), SLEEPY_AFTER_MS);
  }

  /** Shows the pose now, or as soon as the minimum gap allows. The latest pose always wins. */
  private show() {
    const apply = () => {
      this.showTimer = undefined;
      this.shown = this.state.mood;
      this.lastShown = Date.now();
      this.snapshot = { ...this.snapshot, mood: this.shown, reactions: this.state.reactions };
      this.notify();
    };
    if (this.state.mood === this.shown && this.state.reactions === this.snapshot.reactions) return;
    const wait = this.lastShown + MIN_GAP_MS - Date.now();
    if (wait <= 0) {
      clearTimeout(this.showTimer);
      apply();
    } else if (!this.showTimer) this.showTimer = setTimeout(apply, wait);
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }
}

export const deboMood = new MoodStore();

let started = false;
export function useDeboMood(): MoodSnapshot {
  if (!started) {
    started = true;
    deboMood.start();
  }
  return useSyncExternalStore(deboMood.subscribe, deboMood.getSnapshot, deboMood.getSnapshot);
}

async function loadReactions(): Promise<Reactions | undefined> {
  try {
    const raw =
      Platform.OS === "web"
        ? (globalThis.localStorage?.getItem(REACTIONS_KEY) ?? null)
        : await SecureStore.getItemAsync(REACTIONS_KEY);
    return raw === "all" || raw === "calm" || raw === "off" ? raw : undefined;
  } catch {
    return undefined;
  }
}

async function saveReactions(value: Reactions): Promise<void> {
  try {
    if (Platform.OS === "web") globalThis.localStorage?.setItem(REACTIONS_KEY, value);
    else await SecureStore.setItemAsync(REACTIONS_KEY, value);
  } catch {
    // The choice still applies until the app closes.
  }
}
