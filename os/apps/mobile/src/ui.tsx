import { ArrowUpRight, Check, ChevronRight, type LucideIcon, X } from "lucide-react-native";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  borderWidth,
  fontSize,
  fontStack,
  radius,
  shadow,
  sizeElement,
  spacing,
  textStyle,
} from "./astryx-tokens";
import { colors } from "./palette";

export { colors };
export { fontSize, radius, shadow, sizeElement, spacing, textStyle };

/** Body font stack on the web. Native apps use the system font. */
const face = Platform.OS === "web" ? { fontFamily: fontStack.body } : {};
export const fontFamily = face.fontFamily;

export const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  text: { ...face, color: colors.text, ...textStyle.body },
  muted: { ...face, color: colors.muted, ...textStyle.body },
  small: { ...face, color: colors.muted, ...textStyle.supporting },
  label: { ...face, color: colors.muted, ...textStyle.heading5 },
  title: { ...face, color: colors.text, ...textStyle.heading2 },
  heading: { ...face, color: colors.text, ...textStyle.heading3 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.page,
    borderWidth: 0,
    borderColor: colors.line,
    padding: spacing[5],
  },
  divider: { height: borderWidth, backgroundColor: colors.line, marginVertical: spacing[4] },
  input: {
    ...face,
    borderWidth,
    borderColor: colors.inputBorder,
    borderRadius: radius.container,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    color: colors.text,
    fontSize: fontSize.lg,
    backgroundColor: colors.card,
    minHeight: sizeElement.lg,
  },
  field: { gap: spacing[2], marginBottom: spacing[4] },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    minHeight: spacing[11],
    paddingVertical: spacing[2],
    borderRadius: radius.page,
  },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.subtle },
  buttonText: { ...face, ...textStyle.label },
  chip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.page,
    alignSelf: "flex-start",
    backgroundColor: colors.subtle,
  },
  chipText: { ...face, fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
  iconBox: {
    width: spacing[11],
    height: spacing[11],
    borderRadius: radius.container,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.sky,
  },
  error: {
    padding: spacing[4],
    borderRadius: radius.container,
    backgroundColor: colors.dangerBg,
    marginVertical: spacing[3],
    gap: spacing[1],
  },
  modalShade: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing[5],
  },
  sheet: {
    backgroundColor: colors.canvas,
    borderRadius: radius.page,
    width: "100%",
    maxWidth: 790,
    maxHeight: "94%",
    overflow: "hidden",
    borderWidth,
    borderColor: colors.line,
  },
});
export function Button({
  children,
  onPress,
  icon: Icon,
  primary,
  disabled,
  busy,
  small,
  danger,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  icon?: LucideIcon;
  primary?: boolean;
  disabled?: boolean;
  busy?: boolean;
  small?: boolean;
  danger?: boolean;
  style?: ViewStyle;
}) {
  const color = primary ? colors.onAccent : danger ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        primary ? s.primary : s.secondary,
        small && {
          minHeight: spacing[11],
          minWidth: spacing[11],
          paddingVertical: spacing[1.5],
          paddingHorizontal: spacing[3],
        },
        (disabled || busy) && { opacity: 0.5 },
        pressed && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={color} size="small" />
      ) : Icon ? (
        <Icon size={15} color={color} />
      ) : null}
      <Text style={[s.buttonText, { color }]}>{children}</Text>
    </Pressable>
  );
}
export function IconButton({
  icon: Icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: spacing[11],
          height: spacing[11],
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radius.full,
          backgroundColor: pressed ? colors.line : colors.card,
        },
      ]}
    >
      <Icon size={20} strokeWidth={1.8} color={colors.text} />
    </Pressable>
  );
}
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function Chip({ children, tint }: { children: ReactNode; tint?: string }) {
  return (
    <View style={[s.chip, tint ? { backgroundColor: tint } : null]}>
      <Text style={s.chipText}>{children}</Text>
    </View>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={s.field}>
      <Text style={[s.small, { fontWeight: "600", color: colors.text }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        accessibilityLabel={label}
        {...props}
        style={[
          s.input,
          props.multiline && { minHeight: 120, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
export function Empty({
  icon: Icon,
  title,
  detail,
  children,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <View style={{ alignItems: "center", padding: spacing[10], gap: spacing[3] }}>
      <View
        style={[
          s.iconBox,
          {
            width: spacing[12] + spacing[2],
            height: spacing[12] + spacing[2],
            borderRadius: radius.page,
          },
        ]}
      >
        <Icon size={24} color={colors.blueDark} />
      </View>
      <Text style={s.heading}>{title}</Text>
      <Text style={[s.muted, { textAlign: "center", maxWidth: 360 }]}>{detail}</Text>
      {children}
    </View>
  );
}
export function ErrorNotice({ error }: { error?: string }) {
  return error ? (
    <View accessibilityRole="alert" style={s.error}>
      <Text style={[s.text, { color: colors.danger }]}>{error}</Text>
    </View>
  ) : null;
}
export function Sheet({
  title,
  subtitle,
  children,
  onClose,
  wide,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = width < 600;
  return (
    <Modal transparent animationType={compact ? "slide" : "fade"} visible onRequestClose={onClose}>
      <View style={[s.modalShade, compact && { padding: 0, justifyContent: "flex-end" }]}>
        <View
          accessibilityViewIsModal
          style={[
            s.sheet,
            wide && { maxWidth: 1050 },
            compact && {
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              paddingBottom: Math.max(insets.bottom, spacing[3]),
              maxHeight: "94%",
            },
          ]}
        >
          {compact && (
            <View
              style={{
                alignSelf: "center",
                width: spacing[8],
                height: spacing[1],
                borderRadius: radius.inner,
                backgroundColor: colors.lineStrong,
                marginTop: spacing[2],
              }}
            />
          )}
          <View
            style={[
              s.between,
              {
                padding: compact ? spacing[5] : spacing[6],
                borderBottomWidth: borderWidth,
                borderBottomColor: colors.line,
              },
            ]}
          >
            <View style={{ flex: 1, gap: spacing[1] }}>
              <Text style={s.title}>{title}</Text>
              {!!subtitle && <Text style={s.muted}>{subtitle}</Text>}
            </View>
            <IconButton icon={X} label="Close details" onPress={onClose} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: compact ? spacing[5] : spacing[6] }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
export function CheckRow({
  label,
  checked,
  onPress,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={[s.row, { gap: spacing[3], paddingVertical: spacing[2] }]}
    >
      <View
        style={{
          width: spacing[5],
          height: spacing[5],
          borderRadius: radius.inner,
          borderWidth,
          borderColor: checked ? colors.text : colors.inputBorder,
          backgroundColor: checked ? colors.text : colors.card,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked && <Check size={13} color={colors.onInk} />}
      </View>
      <Text style={[s.text, { flex: 1 }]}>{label}</Text>
    </Pressable>
  );
}
export function SectionHeading({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={[s.between, { marginBottom: spacing[5] }]}>
      <Text style={s.heading}>{title}</Text>
      {action && onPress && (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={[s.row, { gap: spacing[1] }]}
        >
          <Text style={[s.small, { color: colors.text }]}>{action}</Text>
          <ArrowUpRight size={13} color={colors.muted} />
        </Pressable>
      )}
    </View>
  );
}
export function LinkRow({
  title,
  detail,
  onPress,
  icon: Icon,
  tint,
}: {
  title: string;
  detail?: string;
  onPress: () => void;
  icon: LucideIcon;
  tint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        s.row,
        { paddingVertical: spacing[3], gap: spacing[3], borderRadius: radius.element },
        pressed && { backgroundColor: colors.canvas },
      ]}
    >
      <View style={[s.iconBox, { backgroundColor: tint || colors.sky }]}>
        <Icon size={19} color={colors.text} />
      </View>
      <View style={{ flex: 1, gap: spacing[1] }}>
        <Text style={[s.text, { fontWeight: "500" }]}>{title}</Text>
        {!!detail && <Text style={s.small}>{detail}</Text>}
      </View>
      <ChevronRight size={15} color={colors.muted} />
    </Pressable>
  );
}
/** Debo, the mascot, shared by every assistant surface. */
export function Mascot({
  size = 42,
  variant = "sky",
}: {
  size?: number;
  variant?: "sky" | "sand" | "lilac";
}) {
  // Soft Butter-theme tints behind Debo. The mascot art itself is never recoloured.
  const palette = {
    sky: colors.blue,
    sand: colors.orange,
    lilac: colors.lavender,
  }[variant];
  return (
    <View accessibilityLabel="Debo" style={{ width: size, height: size }}>
      <View
        style={{
          position: "absolute",
          top: size * 0.15,
          left: size * 0.12,
          width: size * 0.76,
          height: size * 0.76,
          borderRadius: radius.full,
          backgroundColor: palette,
        }}
      />
      <Image
        source={require("../assets/debo.png")}
        resizeMode="contain"
        style={{ width: size, height: size }}
        accessible={false}
      />
    </View>
  );
}
export function dateLabel(value: string, options?: Intl.DateTimeFormatOptions) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", options || { month: "short", day: "numeric" });
}
export function timeLabel(value: string, timeZone?: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });
}
export { relativeDate } from "./relative-date";

export function resultSummary(value: string) {
  return /^Saved to (?:sample|local) sent mail(?: · .+)?$/.test(value)
    ? "Reply saved in your local Sent mail."
    : value;
}
