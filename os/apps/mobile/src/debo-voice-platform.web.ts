// Web: the browser plays the voice and asks for the microphone itself.
// livekit-client is the only voice code the web build needs, and it is
// loaded only when someone presses "Start talking".
import type { RemoteTrack } from "livekit-client";

export interface VoiceAudio {
  /** Play Debo's voice. */
  attach(track: RemoteTrack): void;
  /** Stop the audio session and remove what was added. */
  release(): Promise<void>;
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

