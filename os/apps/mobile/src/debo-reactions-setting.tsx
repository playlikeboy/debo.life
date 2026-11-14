// Settings card: how much Debo's face reacts. Saved on this device only.
import { Text, View } from "react-native";
import type { Reactions } from "./debo-mood";
import { deboMood, useDeboMood } from "./debo-mood-store";
import { Button, Card, s, spacing } from "./ui";

const choices: { value: Reactions; label: string; detail: string }[] = [
  { value: "all", label: "All", detail: "Debo can be playful, including a little pout." },
  { value: "calm", label: "Calm", detail: "Soft reactions only. No pouting or grumpy looks." },
  { value: "off", label: "Off", detail: "Her face stays neutral. She still breathes and blinks." },
];

export function ReactionsSetting() {
  const { reactions } = useDeboMood();
  const current = choices.find((choice) => choice.value === reactions) ?? choices[0];
  return (
    <Card style={{ marginTop: spacing[5], gap: spacing[3] }}>
      <Text style={s.heading}>Debo's reactions</Text>
      <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: spacing[2] }}>
        {choices.map((choice) => (
          <Button
            key={choice.value}
            small
            primary={reactions === choice.value}
            onPress={() => deboMood.setReactions(choice.value)}
          >
            {choice.label}
          </Button>
        ))}
      </View>
      <Text style={s.muted} accessibilityLiveRegion="polite">
        {current.detail} This is saved on this device. The reduce motion setting on your device also
        keeps her still.
      </Text>
    </Card>
  );
}
