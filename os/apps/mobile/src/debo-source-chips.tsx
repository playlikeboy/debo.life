import { BookOpen, FileText, Search } from "lucide-react-native";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { entryFocus, readDeboTool, type SourceChip } from "./debo-data";
import { Button, Card, colors, ErrorNotice, fontSize, radius, s } from "./ui";
import { useWorkspace } from "./workspace";

/** Open the journal on one entry. Used by every source chip. */
export function useOpenEntry() {
  const { navigate } = useWorkspace();
  return (id: string) => {
    entryFocus.set(id);
    navigate("journal");
  };
}

/** Where an answer came from. Each chip opens the entry it names. */
export function SourceChips({ sources }: { sources: SourceChip[] }) {
  const openEntry = useOpenEntry();
  if (sources.length === 0) return null;
  return (
    <View accessibilityLabel="Where this came from" style={{ gap: 6 }}>
      <Text style={s.small}>Where this came from</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {sources.map((source) => (
          <Pressable
            key={source.id}
            accessibilityRole="link"
            accessibilityLabel={`Open the entry: ${source.label}`}
            onPress={() => openEntry(source.id)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              minHeight: 44,
              paddingHorizontal: 12,
              borderRadius: radius.full,
              backgroundColor: pressed ? colors.blue : colors.sky,
              maxWidth: "100%",
            })}
          >
            <BookOpen size={14} color={colors.blueText} />
            <Text style={[s.text, { fontSize: fontSize.supporting, color: colors.blueText, flexShrink: 1 }]}>
              {source.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * The chat card for Debo's journal tools. An answer always shows its source
 * chips; when the journal has nothing, the card says so and shows none.
 */
export function DeboToolCard({
  name,
  result,
  loading,
}: {
  name: "ask_my_life" | "search_my_journal" | "add_journal_entry";
  result: unknown;
  loading: boolean;
}) {
  const { workspace, open, refresh, notify } = useWorkspace();
  const view = loading ? undefined : readDeboTool(name, result);
  const Icon = name === "search_my_journal" ? Search : name === "add_journal_entry" ? FileText : BookOpen;
  const working =
    name === "ask_my_life"
      ? "Looking through your journal…"
      : name === "search_my_journal"
        ? "Searching your journal…"
        : "Getting your entry ready…";
  return (
    <Card style={{ padding: 16, gap: 12, backgroundColor: colors.subtle, maxWidth: 440, width: "100%" }}>
      <View style={[s.row, { gap: 10 }]}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.blueDark} />
        ) : (
          <Icon size={18} color={colors.blueDark} />
        )}
        <Text style={[s.text, { flex: 1 }]}>
          {loading
            ? working
            : view?.kind === "answer"
              ? "From your journal"
              : view?.kind === "matches"
                ? "Found in your journal"
                : view?.kind === "review"
                  ? "Waiting for your OK"
                  : view?.kind === "nothing"
                    ? "Nothing in your journal yet"
                    : "Your journal"}
        </Text>
      </View>
      {view?.kind === "error" && <ErrorNotice error={view.message} />}
      {view?.kind === "unreadable" && (
        <ErrorNotice error="I couldn't read that result. Ask again in a moment." />
      )}
      {view?.kind === "nothing" && <Text style={s.text}>{view.message}</Text>}
      {view?.kind === "answer" && (
        <>
          <Text selectable style={s.text}>
            {view.answer}
          </Text>
          <SourceChips sources={view.sources} />
        </>
      )}
      {view?.kind === "matches" && (
        <>
          {view.excerpts.slice(0, 3).map((hit) => (
            <Text key={`${hit.source.id}-${hit.excerpt.slice(0, 20)}`} numberOfLines={3} style={s.muted}>
              {hit.excerpt}
            </Text>
          ))}
          <SourceChips sources={view.sources} />
        </>
      )}
      {view?.kind === "review" && (
        <>
          <Text style={s.muted}>Nothing is saved until you say yes.</Text>
          <Text selectable numberOfLines={6} style={s.text}>
            {view.preview}
          </Text>
          <Button
            small
            primary
            onPress={() => {
              const find = () => workspace.actions.find((a) => a.id === view.actionId);
              const action = find();
              if (action) return open({ type: "review", action });
              void refresh().then(() =>
                notify("Your entry is ready. Open the bell at the top to review it."),
              );
            }}
          >
            Review this entry
          </Button>
        </>
      )}
    </Card>
  );
}
