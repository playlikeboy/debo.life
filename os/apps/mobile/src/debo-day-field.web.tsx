// Web: the browser's own date picker, which has a calendar and keyboard entry.
import { Text, View } from "react-native";
import { todayInput } from "./debo-data";
import { colors, fontSize, radius, s, spacing } from "./ui";

export function DayField({ value, onChange }: { value: string; onChange: (day: string) => void }) {
  return (
    <View style={{ gap: spacing[2] }}>
      <Text style={[s.small, { fontWeight: "600", color: colors.text }]}>When did this happen?</Text>
      <input
        type="date"
        aria-label="When did this happen?"
        value={value}
        max={todayInput()}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        style={{
          border: `1px solid ${colors.inputBorder}`,
          borderRadius: radius.container,
          padding: spacing[3],
          fontSize: fontSize.base,
          color: colors.text,
          background: colors.card,
          fontFamily: "inherit",
          boxSizing: "border-box",
          minHeight: spacing[11],
          maxWidth: "100%",
        }}
      />
    </View>
  );
}
