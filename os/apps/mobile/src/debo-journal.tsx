import { BookOpen, Check, Pencil, Search, Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { deboApi, errorText } from "./debo-api";
import {
  type DeboStatus,
  type EntryView,
  entryDay,
  entryFocus,
  loadDraft,
  preview,
  saveDraft,
} from "./debo-data";
import { Button, Card, colors, Empty, ErrorNotice, Field, s } from "./ui";
import { useWorkspace } from "./workspace";

/** Shown when there is no Debo database, a plain "not set up" instead of a failure. */
export function NotSetUp({ status, what }: { status?: DeboStatus; what: string }) {
  return (
    <Empty
      icon={BookOpen}
      title={`${what} is not set up yet`}
      detail={
        status?.message ??
        "This server has no Debo journal yet. Your entries are safe wherever they are. Ask whoever runs this server to add the journal database."
      }
    />
  );
}

/** Write, read, find, edit and delete journal entries. */
export function JournalScreen() {
  const { api, notify } = useWorkspace();
  const debo = useMemo(() => deboApi(api), [api]);
  const [status, setStatus] = useState<DeboStatus>();
  const [entries, setEntries] = useState<EntryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(() => loadDraft());
  const [saving, setSaving] = useState(false);
  const [find, setFind] = useState("");
  const [finding, setFinding] = useState("");
  const [focus, setFocus] = useState(entryFocus.get());

  useEffect(() => entryFocus.subscribe(setFocus), []);

  const load = useCallback(
    async (query?: string) => {
      setError("");
      try {
        const next = await debo.status();
        setStatus(next);
        if (next.configured) setEntries(await debo.entries(query));
      } catch (e) {
        setError(errorText(e));
      } finally {
        setLoading(false);
      }
    },
    [debo],
  );
  useEffect(() => {
    void load(finding);
  }, [load, finding]);

  function changeDraft(text: string) {
    setDraft(text);
    saveDraft(text);
  }
  async function save() {
    setSaving(true);
    setError("");
    try {
      await debo.addEntry(draft);
      changeDraft("");
      notify("Entry saved.");
      await load(finding);
    } catch (e) {
      // The draft stays, so nothing the person wrote is lost.
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return <ActivityIndicator accessibilityLabel="Loading your journal" color={colors.blueDark} />;
  if (status && !status.configured) return <NotSetUp status={status} what="Your journal" />;

  const focused = focus ? entries.find((e) => e.id === focus) : undefined;
  const rest = entries.filter((e) => e.id !== focused?.id);

  return (
    <View style={{ gap: 22 }}>
      <Text style={s.muted}>
        Write about your day, the people in it and your plans. Only you can read your entries. Debo
        uses them to answer your questions, and shows which entry each answer came from.
      </Text>
      <ErrorNotice error={error} />
      <Card style={{ gap: 4 }}>
        <Field
          label="Write an entry"
          value={draft}
          onChangeText={changeDraft}
          multiline
          maxLength={20000}
          placeholder="What happened today? Who did you see?"
        />
        <Text style={[s.small, { marginBottom: 12 }]}>
          {draft ? "Your draft is kept on this device until you save it." : "Nothing is saved until you press the button."}
        </Text>
        <Button primary icon={Check} busy={saving} disabled={!draft.trim()} onPress={() => void save()}>
          Save entry
        </Button>
      </Card>

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
          detail="Start small: write one line about today, like who you saw or what you ate. Then you can ask Debo about it."
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
      <Text style={[s.small, { fontWeight: "600", color: colors.text }]}>{day}</Text>
      {editing ? (
        <>
          <Field label="Change this entry" value={text} onChangeText={setText} multiline maxLength={20000} />
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
        <Text
          selectable
          numberOfLines={open ? undefined : 3}
          accessibilityLabel={`Entry from ${day}. ${open ? entry.text : preview(entry.text)}`}
          style={s.text}
        >
          {open ? entry.text : preview(entry.text, 220)}
        </Text>
      )}
      <ErrorNotice error={error} />
      {!editing && !confirming && (
        <View style={[s.row, { gap: 10, flexWrap: "wrap" }]}>
          {entry.text.length > 220 && (
            <Button small onPress={() => setOpen(!open)}>
              {open ? "Show less" : "Read all"}
            </Button>
          )}
          <Button
            small
            icon={Pencil}
            onPress={() => {
              setText(entry.text);
              setOpen(true);
              setEditing(true);
            }}
          >
            Change entry
          </Button>
          <Button small danger icon={Trash2} onPress={() => setConfirming(true)}>
            Delete entry
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
            Delete this entry for good? Debo will also forget what it learned from it. This can&apos;t
            be undone.
          </Text>
          <View style={[s.row, { gap: 10, flexWrap: "wrap" }]}>
            <Button
              danger
              busy={busy}
              icon={Trash2}
              onPress={() => void run(() => debo.deleteEntry(entry.id), "Entry deleted.")}
            >
              Yes, delete this entry
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
