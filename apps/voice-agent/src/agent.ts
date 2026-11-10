// The LiveKit agent: what Debo does when it joins a voice room.
// Loaded by the worker (src/index.ts) in each job process.
//
// Rule: voice is a second way in, not a second brain (docs/VOICE.md).
// Debo must never answer about a person's life from here directly. Every
// answer has to go through the web app's answer pipeline (apps/web
// src/lib/ask.ts: own entries only, sources, daily limit, activity record).
// Plan: call an internal, authenticated API on the web app for answers.
import { defineAgent, type JobContext } from "@livekit/agents";

export default defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();

    // TODO(phase 3, docs/VOICE.md "Choices to make"): pick and install the
    // speech-to-text and text-to-speech plugins, then start a voice session.
    // Only once a TTS plugin is configured may Debo greet, and only with:
    //   "Hi, I'm Debo. Voice is still being built."
    // No provider is chosen yet, so Debo joins and says nothing.
    console.info("voice agent joined a room; no speech provider configured yet", { room: ctx.room.name });
  },
});
