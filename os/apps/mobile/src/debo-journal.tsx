import { BookOpen, Mic, Pencil, RotateCw, Search, Trash2, Video } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { deboApi, errorText } from "./debo-api";
import { Composer } from "./debo-composer";
import {
  type DeboStatus,
  type EntryView,
  entryDay,
  entryFocus,
  formatDuration,
  formatSize,
  kindName,
  preview,
} from "./debo-data";
import { RecordingPlayer } from "./debo-player";
import { Button, Card, colors, Empty, ErrorNotice, Field, s, spacing } from "./ui";
import { useWorkspace } from "./workspace";

/** Shown when there is no Debo database, a plain "not set up" instead of a failure. */
export function NotSetUp({ status, what }: { status?: DeboStatus; what: string }) {
  return (
    <Empty
      icon={BookOpen}
      title={`${what} is not set up yet`}
      detail={
        status?.message ??
        "Your journal is not set up yet. Whoever runs this Debo needs to turn it on. Until then, nothing can be saved here."
      }
    />
  );
}

/** Write, read, find, edit and delete journal entries. */
export function JournalScreen() {
  const { api } = useWorkspace();
  const debo = useMemo(() => deboApi(api), [api]);
  const [status, setStatus] = useState<DeboStatus>();
  const [entries, setEntries] = useState<EntryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [find, setFind] = useState("");
  const [finding, setFinding] = useState("");
  const [focus, setFocus] = useState(entryFocus.get());

  useEffect(() => entryFocus.subscribe(setFocus), []);

  const load = useCallback(
    async (query?: string, quiet = false) => {
      if (!quiet) setError("");
      try {
        const next = await debo.status();
        setStatus(next);
        if (next.configured) setEntries(await debo.entries(query));
      } catch (e) {
        if (!quiet) setError(errorText(e));
      } finally {
        setLoading(false);
      }
    },
    [debo],
  );
  useEffect(() => {
    void load(finding);
  }, [load, finding]);

  // While a recording is being written out, look again every few seconds.
  const writingOut = entries.some((e) => e.media?.transcript.status === "waiting" || e.media?.transcript.status === "working");
  useEffect(() => {
    if (!writingOut) return;
    const timer = setInterval(() => void load(finding, true), 4000);
    return () => clearInterval(timer);
  }, [writingOut, load, finding]);

  if (loading)
    return <ActivityIndicator accessibilityLabel="Loading your journal" color={colors.blueDark} />;
  if (status && !status.configured) return <NotSetUp status={status} what="Your journal" />;

  const focused = focus ? entries.find((e) => e.id === focus) : undefined;
  const rest = entries.filter((e) => e.id !== focused?.id);

  return (
    <View style={{ gap: 22 }}>
      <Text style={s.muted}>
        Write, speak or record. Only you can read your entries. Debo uses them to answer your questions, and shows which
        entry each answer came from.
      </Text>
      <ErrorNotice error={error} />
      <Composer status={status as DeboStatus} onSaved={() => load(finding)} />

      <View style={{ gap: 10 }} accessibilityRole="search">
        <Field
          label="Find an entry"
          value={find}
          onChangeText={setFind}
          maxLength={200}
          returnKeyType="search"
          onSubmitEditing={() => setFinding(find.trim())}
          placeholder="A word or a name"
        />
        <View style={[s.row, { gap: 10, flexWrap: "wrap" }]}>
          <Button icon={Search} onPress={() => setFinding(find.trim())}>
            Find
          </Button>
          {!!finding && (
            <Button
              onPress={() => {
                setFind("");
                setFinding("");
              }}
            >
              Show all entries
            </Button>
          )}
        </View>
        {!!finding && (
          <Text style={s.muted} accessibilityLiveRegion="polite">
            {entries.length === 0
              ? `No entries have “${finding}”. Try a shorter word.`
              : `${entries.length === 1 ? "1 entry has" : `${entries.length} entries have`} “${finding}”.`}
          </Text>
        )}
      </View>

      {focus && !focused && (
        <Card style={{ backgroundColor: colors.orange }}>
          <Text style={s.text}>That entry is gone. It may have been deleted.</Text>
          <Button small style={{ alignSelf: "flex-start", marginTop: 10 }} onPress={() => entryFocus.set(undefined)}>
            Close this note
          </Button>
        </Card>
      )}

      {!finding && entries.length === 0 ? (
        <Empty
          icon={BookOpen}
          title="Nothing here yet"
          detail="Start small: write one line about today, like who you saw or what you ate, or record a short voice note. Then you can ask Debo about it."
        />
      ) : (
        <View accessibilityRole="list" style={{ gap: 14 }}>
          {focused && (
            <EntryCard
              entry={focused}
              highlighted
              startOpen
              onChanged={() => load(finding)}
              onClose={() => entryFocus.set(undefined)}
            />
          )}
          {rest.map((entry) => (
            <EntryCard key={entry.id} entry={entry} onChanged={() => load(finding)} />
          ))}
        </View>
      )}
    </View>
  );
}

function EntryCard({
  entry,
  highlighted,
  startOpen,
  onChanged,
  onClose,
}: {
  entry: EntryView;
  highlighted?: boolean;
  startOpen?: boolean;
  onChanged: () => Promise<void>;
  onClose?: () => void;
}) {
  const { api, notify } = useWorkspace();
  const debo = useMemo(() => deboApi(api), [api]);
  const [open, setOpen] = useState(!!startOpen);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(entry.text);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const day = entryDay(entry.happenedAt);
  const media = entry.media;
  const status = media?.transcript.status;
  const recording = entry.kind !== "journal";

  async function run(work: () => Promise<void>, done: string) {
    setBusy(true);
    setError("");
    try {
      await work();
      notify(done);
      await onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      style={{
        gap: 10,
        padding: 16,
        ...(highlighted ? { borderWidth: 2, borderColor: colors.blueDark } : {}),
      }}
    >
      <View style={[s.row, { gap: spacing[2], flexWrap: "wrap" }]}>
        {recording && (entry.kind === "video" ? <Video size={16} color={colors.blueDark} /> : <Mic size={16} color={colors.blueDark} />)}
        <Text style={[s.small, { fontWeight: "600", color: colors.text }]}>
          {recording ? `${kindName(entry.kind)}, ${day}` : day}
        </Text>
        {media && (
          <Text style={s.small}>
            {media.durationMs ? `${formatDuration(media.durationMs)} · ` : ""}
            {formatSize(media.sizeBytes)}
          </Text>
        )}
      </View>

      {media && (
        <RecordingPlayer
          kind={media.kind}
          label={`${kindName(entry.kind)} from ${day}`}
          load={() => debo.playbackUrl(entry.id)}
        />
      )}

      {media && (status === "waiting" || status === "working") && (
        <View style={[s.row, { gap: spacing[2] }]} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={colors.blueDark} />
          <Text style={s.muted}>Writing out what was said. This can take a minute. You can leave this page.</Text>
        </View>
      )}
      {media && status === "failed" && (
        <View accessibilityRole="alert" style={{ gap: spacing[2] }}>
          <Text style={s.text}>{media.transcript.message ?? "I couldn't write out this recording yet."}</Text>
          <Button
            small
            icon={RotateCw}
            busy={busy}
            style={{ alignSelf: "flex-start" }}
            onPress={() => void run(() => debo.retryTranscript(entry.id), "Trying again.")}
          >
            Try again
          </Button>
        </View>
      )}
      {media && status === "ready" && !entry.text.trim() && !editing && (
        <Text style={s.muted}>I didn't hear any words in this recording.</Text>
      )}

      {editing ? (
        <>
          <Field
            label={recording ? "Fix the words" : "Change this entry"}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={20000}
          />
          <View style={[s.row, { gap: 10, flexWrap: "wrap" }]}>
            <Button
              primary
              busy={busy}
              disabled={!text.trim()}
              onPress={() =>
                void run(async () => {
                  await debo.editEntry(entry.id, text);
                  setEditing(false);
                }, "Changes saved.")
              }
            >
              Save changes
            </Button>
            <Button
              disabled={busy}
              onPress={() => {
                setText(entry.text);
                setEditing(false);
              }}
            >
              Not now
            </Button>
          </View>
        </>
      ) : (
        !!entry.text.trim() && (
          <Text
            selectable
            numberOfLines={open ? undefined : 3}
            accessibilityLabel={`${recording ? `${kindName(entry.kind)} words` : "Entry"} from ${day}. ${open ? entry.text : preview(entry.text)}`}
            style={s.text}
          >
            {open ? entry.text : preview(entry.text, 220)}
          </Text>
        )
      )}
      <ErrorNotice error={error} />
      {!editing && !confirming && (
        <View style={[s.row, { gap: 10, flexWrap: "wrap" }]}>
          {entry.text.length > 220 && (
            <Button small onPress={() => setOpen(!open)}>
              {open ? "Show less" : recording ? "Read all the words" : "Read all"}
            </Button>
          )}
          {(!recording || status === "ready") && (
            <Button
              small
              icon={Pencil}
              onPress={() => {
                setText(entry.text);
                setOpen(true);
                setEditing(true);
              }}
            >
              {recording ? "Fix the words" : "Change entry"}
            </Button>
          )}
          <Button small danger icon={Trash2} onPress={() => setConfirming(true)}>
            {recording ? "Delete recording" : "Delete entry"}
          </Button>
          {onClose && (
            <Button small onPress={onClose}>
              Done
            </Button>
          )}
        </View>
      )}
      {confirming && (
        <View accessibilityRole="alert" style={{ gap: 10 }}>
          <Text style={s.text}>
            {recording
              ? "Delete this recording and its words for good? The file is removed from storage and Debo forgets what it learned from it. This can't be undone."
              : "Delete this entry for good? Debo will also forget what it learned from it. This can't be undone."}
          </Text>
          <View style={[s.row, { gap: 10, flexWrap: "wrap" }]}>
            <Button
              danger
              busy={busy}
              icon={Trash2}
              onPress={() => void run(() => debo.deleteEntry(entry.id), recording ? "Recording deleted." : "Entry deleted.")}
            >
              {recording ? "Yes, delete this recording" : "Yes, delete this entry"}
            </Button>
            <Button disabled={busy} onPress={() => setConfirming(false)}>
              Keep it
            </Button>
          </View>
        </View>
      )}
    </Card>
  );
}
