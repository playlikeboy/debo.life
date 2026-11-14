// Adding a voice note or a video: record one here, or pick a file you already
// have. You can listen back (or watch) before anything is saved. Nothing leaves
// this device until you press "Save recording".
import { Circle, Mic, Square, Trash2, Upload, Video } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import { deboApi, errorText } from "./debo-api";
import {
  type Capture,
  type LiveRecording,
  pickRecording,
  recordingSupport,
  releaseCapture,
  sendRange,
  startRecording,
} from "./debo-capture";
import {
  type DeboStatus,
  type EntryView,
  fileProblem,
  formatDuration,
  formatSize,
  happenedAtFor,
  todayInput,
} from "./debo-data";
import { DayField } from "./debo-day-field";
import { LivePreview, RecordingPlayer } from "./debo-player";
import { uploadRecording } from "./debo-upload";
import { Button, Card, colors, ErrorNotice, radius, s, spacing } from "./ui";
import { useWorkspace } from "./workspace";

type Stage = "choose" | "recording" | "review" | "uploading";

/** The day a picked file was made, as the date box shows it. */
function dayOf(capture: Capture): string {
  return capture.origin === "picked" && capture.lastModified ? todayInput(new Date(capture.lastModified)) : todayInput();
}

export function RecordingPanel({
  mode,
  status,
  onClose,
  onSaved,
}: {
  mode: "record" | "pick";
  status: DeboStatus;
  onClose: () => void;
  onSaved: (entry: EntryView) => void;
}) {
  const { api, notify } = useWorkspace();
  const debo = useMemo(() => deboApi(api), [api]);
  const [stage, setStage] = useState<Stage>(mode === "pick" ? "review" : "choose");
  const [live, setLive] = useState<LiveRecording | undefined>(undefined);
  const [kind, setKind] = useState<"voice" | "video">("voice");
  const [elapsed, setElapsed] = useState(0);
  const [capture, setCapture] = useState<Capture | undefined>(undefined);
  const [day, setDay] = useState(todayInput());
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const liveRef = useRef<LiveRecording | undefined>(undefined);
  const captureRef = useRef<Capture | undefined>(undefined);
  const support = recordingSupport();
  const maxMs = status.limits.maxMinutes * 60_000;

  // Whatever happens, the mic and camera are off and the preview is released when this goes away.
  useEffect(
    () => () => {
      liveRef.current?.cancel();
      if (captureRef.current) releaseCapture(captureRef.current);
    },
    [],
  );

  const keep = useCallback((next: Capture | undefined) => {
    if (captureRef.current && captureRef.current !== next) releaseCapture(captureRef.current);
    captureRef.current = next;
    setCapture(next);
  }, []);

  const choose = useCallback(async () => {
    setError("");
    try {
      const picked = await pickRecording();
      if (!picked) return onClose();
      const problem = fileProblem(picked, status.limits);
      if (problem) {
        releaseCapture(picked);
        setError(problem);
        return;
      }
      if (picked.durationMs && picked.durationMs > maxMs) {
        releaseCapture(picked);
        setError(`That recording is too long. Keep it under ${status.limits.maxMinutes} minutes.`);
        return;
      }
      keep(picked);
      setDay(dayOf(picked));
    } catch (e) {
      setError(errorText(e));
    }
  }, [keep, maxMs, onClose, status.limits]);

  // "Add a recording" opens the file picker straight away.
  const asked = useRef(false);
  useEffect(() => {
    if (mode === "pick" && !asked.current) {
      asked.current = true;
      void choose();
    }
  }, [mode, choose]);

  async function begin(which: "voice" | "video") {
    setError("");
    setKind(which);
    try {
      const recording = await startRecording(which, (ms) => setElapsed(ms));
      liveRef.current = recording;
      setLive(recording);
      setElapsed(0);
      setStage("recording");
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function finish() {
    const recording = liveRef.current;
    if (!recording) return;
    liveRef.current = undefined;
    setLive(undefined);
    try {
      const result = await recording.stop();
      const problem = fileProblem(result, status.limits);
      if (problem) {
        setError(problem);
        setStage("choose");
        return;
      }
      keep(result);
      setDay(todayInput());
      setStage("review");
    } catch (e) {
      setError(errorText(e));
      setStage("choose");
    }
  }

  // The hour limit: stop on our own, and say so.
  useEffect(() => {
    if (stage === "recording" && elapsed >= maxMs) {
      notify(`That is ${status.limits.maxMinutes} minutes, the longest one recording can be. Saving it now would be a good idea.`);
      void finish();
    }
    // biome-ignore lint/correctness/useExhaustiveDependencies: finish reads refs only
  }, [elapsed, stage, maxMs]);

  async function save() {
    if (!capture) return;
    setStage("uploading");
    setError("");
    setProgress(0);
    try {
      const entry = await uploadRecording(debo, sendRange, capture, {
        happenedAt: happenedAtFor(day),
        onProgress: setProgress,
      });
      notify(entry.kind === "video" ? "Video saved. I am writing out what was said." : "Voice note saved. I am writing out what was said.");
      keep(undefined);
      onSaved(entry);
    } catch (e) {
      // The recording is still here, so the person can try again without recording it twice.
      setError(errorText(e));
      setStage("review");
    }
  }

  const days = Math.max(0, Math.round(status.limits.maxMinutes));
  const limitLine = `Up to ${Math.round(status.limits.maxBytes / (1024 * 1024))} MB and ${days} minutes each.`;

  return (
    <Card style={{ gap: spacing[3], backgroundColor: colors.subtle }}>
      <ErrorNotice error={error} />

      {stage === "choose" && (
        <>
          <Text style={s.heading}>Record a note</Text>
          {support.voice ? (
            <View style={[s.row, { gap: spacing[2], flexWrap: "wrap" }]}>
              <Button primary icon={Mic} onPress={() => void begin("voice")}>
                Record your voice
              </Button>
              {support.video && (
                <Button icon={Video} onPress={() => void begin("video")}>
                  Record a video
                </Button>
              )}
              <Button onPress={onClose}>Not now</Button>
            </View>
          ) : (
            <View style={{ gap: spacing[2] }}>
              <Text style={s.muted}>
                Recording inside the app does not work here yet. Record with your phone's voice recorder, then use “Add a
                recording” to pick the file.
              </Text>
              <Button style={{ alignSelf: "flex-start" }} onPress={onClose}>
                Close
              </Button>
            </View>
          )}
          <Text style={s.small}>
            {limitLine} The microphone is only on while you see “Recording”. Your recording is kept privately and only you can
            play it. Debo writes out the words with Cloudflare's speech service. You can delete it whenever you like.
          </Text>
        </>
      )}

      {stage === "recording" && live && (
        <>
          <View style={[s.row, { gap: spacing[2] }]} accessibilityLiveRegion="polite">
            <Circle size={14} color={colors.danger} fill={colors.danger} />
            <Text style={s.heading}>
              {kind === "video" ? "Recording video" : "Recording"} {formatDuration(elapsed)}
            </Text>
          </View>
          <LivePreview recording={live} />
          <View style={[s.row, { gap: spacing[2], flexWrap: "wrap" }]}>
            <Button primary icon={Square} onPress={() => void finish()}>
              Stop recording
            </Button>
            <Button
              onPress={() => {
                liveRef.current?.cancel();
                liveRef.current = undefined;
                setLive(undefined);
                setStage("choose");
              }}
            >
              Cancel
            </Button>
          </View>
        </>
      )}

      {(stage === "review" || stage === "uploading") && !capture && mode === "pick" && !error && (
        <Text style={s.muted}>Opening your files…</Text>
      )}
      {(stage === "review" || stage === "uploading") && !capture && mode === "pick" && !!error && (
        <View style={[s.row, { gap: spacing[2], flexWrap: "wrap" }]}>
          <Button icon={Upload} onPress={() => void choose()}>
            Pick another file
          </Button>
          <Button onPress={onClose}>Close</Button>
        </View>
      )}

      {(stage === "review" || stage === "uploading") && capture && (
        <>
          <Text style={s.heading}>{capture.kind === "video" ? "Watch it first" : "Listen first"}</Text>
          <Text style={s.small}>
            {capture.name} · {capture.durationMs ? `${formatDuration(capture.durationMs)} · ` : ""}
            {formatSize(capture.sizeBytes)}
          </Text>
          <RecordingPlayer
            kind={capture.kind}
            src={capture.previewUri}
            label={capture.kind === "video" ? "Preview of your video" : "Preview of your voice note"}
          />
          <DayField value={day} onChange={setDay} />
          {stage === "uploading" ? (
            <View accessibilityLiveRegion="polite" style={{ gap: spacing[2] }}>
              <Text style={s.text}>Saving your recording… {Math.round(progress * 100)}%</Text>
              <View
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
                style={{ height: spacing[2], borderRadius: radius.full, backgroundColor: colors.line, overflow: "hidden" }}
              >
                <View style={{ width: `${Math.round(progress * 100)}%`, height: "100%", backgroundColor: colors.accent }} />
              </View>
              <Text style={s.small}>Keep this page open until it says saved.</Text>
            </View>
          ) : (
            <View style={[s.row, { gap: spacing[2], flexWrap: "wrap" }]}>
              <Button primary icon={Upload} onPress={() => void save()}>
                Save recording
              </Button>
              {mode === "record" ? (
                <Button
                  icon={Mic}
                  onPress={() => {
                    keep(undefined);
                    setStage("choose");
                  }}
                >
                  Record again
                </Button>
              ) : (
                <Button
                  icon={Upload}
                  onPress={() => {
                    keep(undefined);
                    void choose();
                  }}
                >
                  Pick another file
                </Button>
              )}
              <Button
                danger
                icon={Trash2}
                onPress={() => {
                  keep(undefined);
                  onClose();
                }}
              >
                Throw it away
              </Button>
            </View>
          )}
          <Text style={s.small}>
            Kept privately; only you can play it. Debo writes out the words with Cloudflare's speech service.
          </Text>
        </>
      )}
    </Card>
  );
}
