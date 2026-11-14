// Developer gallery: every mood side by side, with buttons that drive the shared
// face. It only opens on a local sample install, at `?face=gallery`.
import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { DeboFace } from "./debo-face";
import { allMoods, detectTone } from "./debo-mood";
import { deboMood, useDeboMood } from "./debo-mood-store";
import { TalkPopup } from "./debo-talk";
import type { VoiceConnection, VoiceHandlers } from "./debo-voice-engine";
import { Button, colors, s, spacing } from "./ui";
import { WorkspaceContext, type WorkspaceContextValue } from "./workspace";

// The popup needs a workspace and a voice connection. In the gallery both are stand-ins:
// no server, no microphone. The stand-in plays a short scripted conversation, with
// audio levels, so the halo and mouth can be watched without LiveKit.
const standIn = {
  workspace: {},
  api: {},
  section: "talk",
  navigate: () => {},
  refresh: async () => {},
  open: () => {},
  close: () => {},
  notify: () => {},
  ask: () => {},
} as unknown as WorkspaceContextValue;

async function demoVoice(_api: unknown, handlers: VoiceHandlers): Promise<VoiceConnection> {
  await new Promise((done) => setTimeout(done, 700));
  const timers: ReturnType<typeof setTimeout>[] = [];
  let level: ReturnType<typeof setInterval> | undefined;
  let mode: "you" | "debo" | "none" = "none";
  const at = (ms: number, run: () => void) => timers.push(setTimeout(run, ms));
  handlers.onAgentState("listening");
  mode = "you";
  at(3500, () => {
    mode = "none";
    handlers.onAgentState("thinking");
    handlers.onLine("a", "you", "What did I write about the trip?", true);
  });
  at(5200, () => {
    mode = "debo";
    handlers.onAgentState("speaking");
    handlers.onLine("b", "debo", "You wrote about the", false);
  });
  at(6200, () => handlers.onLine("b", "debo", "You wrote about the sunrise in Goa on 11 November.", true));
  at(6300, () => handlers.onSources([{ id: "e1", label: "Journal, 11 November" }]));
  at(10500, () => {
    mode = "you";
    handlers.onAgentState("listening");
  });
  let t = 0;
  level = setInterval(() => {
    t += 0.066;
    const wave = Math.abs(Math.sin(t * 7) * Math.sin(t * 2.3));
    handlers.onLevels?.({ you: mode === "you" ? wave : 0, debo: mode === "debo" ? wave : 0, real: true });
  }, 66);
  return {
    microphoneBlocked: false,
    async setMicrophone() {},
    async stopDebo() {
      mode = "none";
      handlers.onAgentState("listening");
    },
    async sendText() {},
    async end() {
      clearInterval(level);
      for (const timer of timers) clearTimeout(timer);
      handlers.onLevels?.({ you: 0, debo: 0, real: false });
      handlers.onEnded();
    },
  };
}

export function DeboFaceGallery() {
  const shared = useDeboMood();
  const [text, setText] = useState("");
  const [popup, setPopup] = useState(false);
  const buttons: [string, () => void][] = [
    ["Waiting", () => deboMood.emit({ type: "waiting" })],
    ["Streaming", () => deboMood.emit({ type: "streaming" })],
    ["Answer + sources", () => deboMood.emit({ type: "answer", text: "Here you go.", hasSources: true })],
    ["No memory", () => deboMood.emit({ type: "answer", text: "I don't have anything about that yet.", hasSources: false })],
    ["Error", () => deboMood.emit({ type: "error", actionable: false })],
    ["Task done", () => deboMood.emit({ type: "task_done" })],
    ["Approval waiting", () => deboMood.emit({ type: "approval_waiting" })],
    ["Journal saved", () => deboMood.emit({ type: "journal_saved" })],
    ["Deleted", () => deboMood.emit({ type: "deleted" })],
    ["Quiet a while", () => deboMood.emit({ type: "idle_long" })],
    ["Tap", () => deboMood.tap()],
  ];
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.canvas }} contentContainerStyle={{ padding: spacing[5], gap: spacing[5] }}>
      <Text style={s.title}>Debo's face</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[4] }}>
        {allMoods.map((mood) => (
          <View key={mood} testID={`mood-${mood}`} style={{ alignItems: "center", gap: spacing[1] }}>
            <DeboFace size={150} mood={mood} />
            <Text style={s.small}>{mood}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", gap: spacing[4] }}>
        {(["pouty", "worried"] as const).flatMap((mood) =>
          [24, 64, 180, 260].map((size) => (
            <View key={`${mood}-${size}`} testID={`size-${mood}-${size}`}>
              <DeboFace size={size} mood={mood} />
            </View>
          )),
        )}
      </View>
      <View style={{ gap: spacing[3] }}>
        <Text style={s.heading}>Shared face: {shared.mood} (reactions: {shared.reactions})</Text>
        <DeboFace size={180} interactive />
        <TextInput
          accessibilityLabel="Say something to Debo"
          value={text}
          onChangeText={setText}
          placeholder="Say something, then press Send"
          style={[s.input, { maxWidth: 420 }]}
        />
        <Text style={s.small}>Tone read as: {detectTone(text)}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
          <Button
            primary
            onPress={() => {
              deboMood.emit({ type: "user_message", text });
              setText("");
            }}
          >
            Send
          </Button>
          {buttons.map(([label, run]) => (
            <Button key={label} small onPress={run}>
              {label}
            </Button>
          ))}
          <Button small onPress={() => setPopup(true)}>
            Open voice popup (demo)
          </Button>
          {(["all", "calm", "off"] as const).map((value) => (
            <Button key={value} small onPress={() => deboMood.setReactions(value)}>
              {`Reactions: ${value}`}
            </Button>
          ))}
        </View>
      </View>
      {popup && (
        <WorkspaceContext.Provider value={standIn}>
          <TalkPopup engine={demoVoice} onClose={() => setPopup(false)} />
        </WorkspaceContext.Provider>
      )}
    </ScrollView>
  );
}
