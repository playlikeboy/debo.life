// The live voice connection, the same on the web and on phones.
//
// It joins a LiveKit room with a token from POST /api/voice/token. Debo's
// voice agent joins the same room. Captions arrive on LiveKit's
// "lk.transcription" text stream, source chips on "debo.sources", typed
// messages go out on "lk.chat", and "Stop Debo" calls the agent's
// "debo.interrupt" RPC. Audio is never recorded by Debo.
//
// livekit-client is loaded only when a conversation starts, so the rest of
// the app does not pay for it.
import type { Room, TextStreamReader } from "livekit-client";
import type { FuseApi } from "./api";
import { smoothLevel } from "./audio-level";
import { createLevelMeter, type LevelMeter, prepareVoiceAudio, type VoiceAudio } from "./debo-voice-platform";

export interface VoiceChip {
  id: string;
  label: string;
}
export type AgentState = "listening" | "thinking" | "speaking" | "initializing" | "";

/** How loud each side is right now, 0..1, already smoothed. */
export interface VoiceLevels {
  you: number;
  debo: number;
  /** True when `debo` is a real audio reading (web). False when it only follows who is speaking. */
  real: boolean;
}

export interface VoiceHandlers {
  /** A caption changed. `final` is true when the sentence is complete. */
  onLine(id: string, who: "you" | "debo", text: string, final: boolean): void;
  onSources(chips: VoiceChip[]): void;
  onAgentState(state: AgentState): void;
  /** The connection closed, for any reason. */
  onEnded(): void;
  /** Audio levels for Debo's face and the halo, about 15 times a second. Optional. */
  onLevels?(levels: VoiceLevels): void;
  /** The network dropped and LiveKit is trying again, or it is back. Optional. */
  onConnection?(state: "connected" | "reconnecting"): void;
}

export interface VoiceConnection {
  /** True when the phone or browser refused the microphone. Typing still works. */
  microphoneBlocked: boolean;
  setMicrophone(on: boolean): Promise<void>;
  stopDebo(): Promise<void>;
  sendText(text: string): Promise<void>;
  end(): Promise<void>;
}

const START_FAILED = "I couldn't start a voice session. Check your connection and try again.";

export async function startVoice(api: FuseApi, handlers: VoiceHandlers): Promise<VoiceConnection> {
  const session = await api
    .request<{ url?: string; token?: string }>("/api/voice/token", {})
    .catch((error: unknown) => {
      throw new Error(error instanceof Error && error.message ? error.message : START_FAILED);
    });
  if (!session.url || !session.token) throw new Error(START_FAILED);

  const audio: VoiceAudio = await prepareVoiceAudio();
  let room: Room | undefined;
  let poll: ReturnType<typeof setInterval> | undefined;
  try {
    const { Room: LiveKitRoom, RoomEvent, Track } = await import("livekit-client");
    const connected = new LiveKitRoom({ adaptiveStream: true, dynacast: true });
    room = connected;
    let ended = false;
    const meters: { you?: LevelMeter; debo?: LevelMeter } = {};
    let you = 0;
    let debo = 0;
    let last = Date.now();
    // Levels come from an audio analyser on the web, and from LiveKit's own speaker
    // levels on phones. Either way they only drive animation.
    poll = setInterval(() => {
      const now = Date.now();
      const dt = now - last;
      last = now;
      const local = connected.localParticipant;
      const agent = [...connected.remoteParticipants.values()].find((p) => p.isAgent);
      const rawYou = meters.you
        ? meters.you.read()
        : local.isSpeaking
          ? 0.25 + local.audioLevel * 0.75
          : 0;
      const rawDebo = meters.debo
        ? meters.debo.read()
        : agent?.isSpeaking
          ? 0.3 + agent.audioLevel * 0.7
          : 0;
      you = smoothLevel(you, rawYou, dt);
      debo = smoothLevel(debo, rawDebo, dt);
      handlers.onLevels?.({ you, debo, real: !!meters.debo });
    }, 66);
    const finish = () => {
      if (ended) return;
      ended = true;
      clearInterval(poll);
      meters.you?.stop();
      meters.debo?.stop();
      handlers.onLevels?.({ you: 0, debo: 0, real: false });
      handlers.onAgentState("");
      handlers.onEnded();
      void audio.release();
    };

    connected.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) {
        audio.attach(track);
        meters.debo?.stop();
        meters.debo = createLevelMeter(track.mediaStreamTrack);
      }
    });
    connected.on(RoomEvent.LocalTrackPublished, (publication) => {
      if (publication.source !== Track.Source.Microphone || !publication.track) return;
      meters.you?.stop();
      meters.you = createLevelMeter(publication.track.mediaStreamTrack);
    });
    connected.on(RoomEvent.Reconnecting, () => handlers.onConnection?.("reconnecting"));
    connected.on(RoomEvent.Reconnected, () => handlers.onConnection?.("connected"));
    connected.on(RoomEvent.ParticipantAttributesChanged, (_changed, participant) => {
      const state = participant.attributes["lk.agent.state"];
      if (state) handlers.onAgentState(state as AgentState);
    });
    connected.on(RoomEvent.Disconnected, finish);

    connected.registerTextStreamHandler(
      "lk.transcription",
      async (reader: TextStreamReader, from: { identity: string }) => {
        const id = reader.info.attributes?.["lk.segment_id"] ?? reader.info.id;
        const who = from.identity === connected.localParticipant.identity ? "you" : "debo";
        let text = "";
        for await (const chunk of reader) {
          text += chunk;
          handlers.onLine(id, who, text, false);
        }
        handlers.onLine(id, who, text, true);
      },
    );
    connected.registerTextStreamHandler("debo.sources", async (reader: TextStreamReader) => {
      try {
        const parsed: unknown = JSON.parse(await reader.readAll());
        if (!Array.isArray(parsed)) return;
        handlers.onSources(
          parsed.filter(
            (chip): chip is VoiceChip =>
              typeof chip?.id === "string" && typeof chip?.label === "string",
          ),
        );
      } catch {
        // A bad sources message is ignored. The answer still plays.
      }
    });

    await connected.connect(session.url, session.token);
    let microphoneBlocked = false;
    try {
      await connected.localParticipant.setMicrophoneEnabled(true);
    } catch {
      // Keep the conversation open so the person can still type to Debo.
      microphoneBlocked = true;
    }

    return {
      microphoneBlocked,
      async setMicrophone(on) {
        await connected.localParticipant.setMicrophoneEnabled(on);
      },
      async stopDebo() {
        const agent = [...connected.remoteParticipants.values()].find((p) => p.isAgent);
        if (!agent) return;
        await connected.localParticipant
          .performRpc({ destinationIdentity: agent.identity, method: "debo.interrupt", payload: "" })
          .catch(() => {});
      },
      async sendText(text) {
        await connected.localParticipant.sendText(text, { topic: "lk.chat" });
      },
      async end() {
        await connected.disconnect();
        finish();
      },
    };
  } catch (error) {
    clearInterval(poll);
    await room?.disconnect().catch(() => {});
    await audio.release();
    throw error;
  }
}

/** Plain-English words for a failed start. */
export function startProblem(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError")
      return "Debo can't use your microphone. Allow it in your settings, or type to Debo instead.";
    if (error.message) return error.message;
  }
  return START_FAILED;
}
