// iOS and Android: voice needs the Debo app build (an Expo development build
// or a store build), because WebRTC is native code that Expo Go does not
// include. In that build, @livekit/react-native sets up the WebRTC globals and
// the phone's audio session, and the same livekit-client code as the web runs
// on top. Steps to make that build are in docs/VOICE.md.
import type { RemoteTrack } from "livekit-client";

/** Reads how loud a track is right now, 0..1. */
export interface LevelMeter {
  read(): number;
  stop(): void;
}

/**
 * Phones have no AnalyserNode. The engine falls back to the level LiveKit reports for
 * each speaker (audioLevel) and the isSpeaking flag, which is coarser but real.
 */
export function createLevelMeter(_track: MediaStreamTrack): LevelMeter | undefined {
  return undefined;
}

export interface VoiceAudio {
  /** Debo's voice plays through the phone's audio session; nothing to attach. */
  attach(track: RemoteTrack): void;
  /** Stop the audio session. */
  release(): Promise<void>;
}


export async function prepareVoiceAudio(): Promise<VoiceAudio> {
  let native: typeof import("@livekit/react-native");
  try {
    native = await import("@livekit/react-native");
  } catch {
    throw new VoiceNeedsAppBuild();
  }
  try {
    native.registerGlobals();
    await native.AudioSession.startAudioSession();
  } catch {
    // Expo Go and builds made before the voice plugins were added have no WebRTC module.
    throw new VoiceNeedsAppBuild();
  }
  return {
    attach() {},
    async release() {
      await native.AudioSession.stopAudioSession().catch(() => {});
    },
  };
}

export class VoiceNeedsAppBuild extends Error {
  constructor() {
    super("Voice needs the Debo app build. It does not work in Expo Go. You can still type to Debo.");
    this.name = "VoiceNeedsAppBuild";
  }
}
