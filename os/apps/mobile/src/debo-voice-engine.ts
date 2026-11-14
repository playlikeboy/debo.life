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
import { prepareVoiceAudio, type VoiceAudio } from "./debo-voice-platform";

export interface VoiceChip {
  id: string;
  label: string;
}
export type AgentState = "listening" | "thinking" | "speaking" | "initializing" | "";

export interface VoiceHandlers {
  /** A caption changed. `final` is true when the sentence is complete. */
  onLine(id: string, who: "you" | "debo", text: string, final: boolean): void;
  onSources(chips: VoiceChip[]): void;
  onAgentState(state: AgentState): void;
  /** The connection closed, for any reason. */
  onEnded(): void;
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
  try {
    const { Room: LiveKitRoom, RoomEvent, Track } = await import("livekit-client");
    const connected = new LiveKitRoom({ adaptiveStream: true, dynacast: true });
    room = connected;
    let ended = false;
    const finish = () => {
      if (ended) return;
      ended = true;
      handlers.onAgentState("");
      handlers.onEnded();
      void audio.release();
    };

    connected.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) audio.attach(track);
    });
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
