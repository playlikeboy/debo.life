// Phone: no audio or video player is in the app yet (it needs a native module
// and a new development build). "Play" opens the recording in the phone's own
// player or browser instead. See os/docs/JOURNAL-MEDIA.md.
import { Play } from "lucide-react-native";
import { useState } from "react";
import { Linking, Text, View } from "react-native";
import { errorText } from "./debo-api";
import type { LiveRecording } from "./debo-capture-types";
import { Button, colors, s, spacing } from "./ui";

type Props = {
  kind: "voice" | "video";
  src?: string;
  load?: () => Promise<string>;
  label: string;
};

export function RecordingPlayer({ kind, src, load }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <View style={{ gap: spacing[2] }}>
      <Button
        small
        icon={Play}
        busy={busy}
        onPress={() => {
          setBusy(true);
          setError("");
          (src ? Promise.resolve(src) : (load?.() ?? Promise.reject(new Error("No recording."))))
            .then((url) => Linking.openURL(url))
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

export function LivePreview(_props: { recording: LiveRecording }) {
  return null;
}
