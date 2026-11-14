// Web: the browser's own audio and video players, which already have play,
// pause, a scrub bar, volume and keyboard control.
import { Play } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { errorText } from "./debo-api";
import type { LiveRecording } from "./debo-capture-types";
import { Button, colors, radius, s, spacing } from "./ui";

type Props = {
  kind: "voice" | "video";
  /** Something to play right now (a recording not saved yet). */
  src?: string;
  /** Or a way to get a short-lived link when the person presses Play (a saved recording). */
  load?: () => Promise<string>;
  label: string;
};

const mediaStyle = {
  width: "100%",
  borderRadius: radius.container,
  backgroundColor: colors.subtle,
  outlineColor: colors.blueDark,
} as const;

export function RecordingPlayer({ kind, src, load, label }: Props) {
  const [url, setUrl] = useState(src);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setUrl(src), [src]);

  if (!url) {
    return (
      <View style={{ gap: spacing[2] }}>
        <Button
          small
          icon={Play}
          busy={busy}
          onPress={() => {
            setBusy(true);
            setError("");
            load?.()
              .then(setUrl)
              .catch((e) => setError(errorText(e)))
              .finally(() => setBusy(false));
          }}
        >
          {kind === "video" ? "Play video" : "Play voice note"}
        </Button>
        {!!error && <Text style={[s.small, { color: colors.danger }]}>{error}</Text>}
      </View>
    );
  }
  const common = {
    src: url,
    controls: true,
    autoPlay: !src,
    preload: "metadata",
    "aria-label": label,
    style: mediaStyle,
    // A link that has run out: ask for a new one the next time Play is pressed.
    onError: () => {
      if (!src) {
        setUrl(undefined);
        setError("The link ran out. Press Play again.");
      }
    },
  };
  return kind === "video" ? (
    <video {...common} playsInline style={{ ...mediaStyle, maxHeight: 360 }} />
  ) : (
    <audio {...common} style={{ ...mediaStyle, height: spacing[11] }} />
  );
}

/** The camera picture while a video is being recorded. Muted, so it does not echo. */
export function LivePreview({ recording }: { recording: LiveRecording }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && recording.stream) ref.current.srcObject = recording.stream as MediaStream;
  }, [recording]);
  if (!recording.stream) return null;
  return (
    <video
      ref={ref}
      autoPlay
      muted
      playsInline
      aria-label="What the camera sees"
      style={{ ...mediaStyle, maxHeight: 280, backgroundColor: colors.ink }}
    />
  );
}
