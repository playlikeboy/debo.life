// Developer gallery: every mood side by side, with buttons that drive the shared
// face. It only opens on a local sample install, at `?face=gallery`.
import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { DeboFace } from "./debo-face";
import { allMoods, detectTone } from "./debo-mood";
import { deboMood, useDeboMood } from "./debo-mood-store";
import { Button, colors, s, spacing } from "./ui";

export function DeboFaceGallery() {
  const shared = useDeboMood();
  const [text, setText] = useState("");
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
          {(["all", "calm", "off"] as const).map((value) => (
            <Button key={value} small onPress={() => deboMood.setReactions(value)}>
              {`Reactions: ${value}`}
            </Button>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
