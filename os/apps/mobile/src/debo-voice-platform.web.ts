// Web: the browser plays the voice and asks for the microphone itself.
// livekit-client is the only voice code the web build needs, and it is
// loaded only when someone presses "Start talking".
import type { RemoteTrack } from "livekit-client";
import { rmsLevel } from "./audio-level";

export interface VoiceAudio {
  /** Play Debo's voice. */
  attach(track: RemoteTrack): void;
  /** Stop the audio session and remove what was added. */
  release(): Promise<void>;
}

/** Reads how loud a track is right now, 0..1. */
export interface LevelMeter {
  read(): number;
  stop(): void;
}

/**
 * Web: an AnalyserNode on the live audio track gives a real loudness reading, so
 * Debo's mouth and the halo follow the actual voice. The audio is only measured,
 * never recorded or sent anywhere.
 */
export function createLevelMeter(track: MediaStreamTrack): LevelMeter | undefined {
  try {
    const Context: typeof AudioContext | undefined =
      globalThis.AudioContext ??
      (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return undefined;
    const context = new Context();
    const source = context.createMediaStreamSource(new MediaStream([track]));
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser); // not connected to the speakers, so nothing plays twice
    const data = new Uint8Array(analyser.fftSize);
    return {
      read() {
        analyser.getByteTimeDomainData(data);
        return rmsLevel(data, true);
      },
      stop() {
        source.disconnect();
        void context.close().catch(() => {});
      },
    };
  } catch {
    return undefined;
  }
}

export async function prepareVoiceAudio(): Promise<VoiceAudio> {
  const elements: HTMLElement[] = [];
  return {
    attach(track) {
      const element = track.attach();
      element.style.display = "none";
      document.body.appendChild(element);
      elements.push(element);
    },
    async release() {
      for (const element of elements) element.remove();
      elements.length = 0;
    },
  };
}
