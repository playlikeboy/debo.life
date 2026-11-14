import { Brain, Pencil, Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { deboApi, errorText } from "./debo-api";
import { type DeboStatus, type MemoryView } from "./debo-data";
import { NotSetUp } from "./debo-journal";
import { SourceChips } from "./debo-source-chips";
import { deboMood } from "./debo-mood-store";
import { Button, Card, colors, Empty, ErrorNotice, Field, s } from "./ui";
import { useWorkspace } from "./workspace";

/** What Debo knows: each memory, the entry it came from, and a way to fix or forget it. */
export function KnowsScreen() {
  const { api } = useWorkspace();
  const debo = useMemo(() => deboApi(api), [api]);
  const [status, setStatus] = useState<DeboStatus>();
  const [memories, setMemories] = useState<MemoryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const next = await debo.status();
      setStatus(next);
      // Memory off is not an error: the screen explains it.
      if (next.configured && next.memories) setMemories(await debo.memories());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [debo]);
  useEffect(() => {
    void load();
  }, [load]);

  if (loading)
    return <ActivityIndicator accessibilityLabel="Loading what Debo knows" color={colors.blueDark} />;
  if (status && !status.configured) return <NotSetUp status={status} what="What Debo knows" />;

  return (
    <View style={{ gap: 18 }}>
      <Text style={s.muted}>
        After you save an entry, Debo picks out the lasting facts in it, like people, places and
        plans. Each memory shows the entry it came from. Fix anything that is wrong, or forget
        anything you don&apos;t want Debo to keep.
      </Text>
      <ErrorNotice error={error} />
      {status && !status.memories ? (
        <Empty
          icon={Brain}
          title="Debo is not keeping memories right now"
          detail="Your entries are safe, and you can still ask about them."
        />
      ) : memories.length === 0 && !error ? (
        <Empty
          icon={Brain}
          title="Nothing yet"
          detail="Write an entry about the people, places and plans in your life, and Debo will remember them here within a minute or so."
        >
          <Button onPress={() => void load()}>Check again</Button>
        </Empty>
      ) : (
        <View accessibilityRole="list" style={{ gap: 14 }}>
          {memories.map((memory) => (
            <MemoryCard key={memory.id} memory={memory} onChanged={load} />
          ))}
        </View>
      )}
    </View>
  );
}

function MemoryCard({ memory, onChanged }: { memory: MemoryView; onChanged: () => Promise<void> }) {
  const { api, notify } = useWorkspace();
  const debo = useMemo(() => deboApi(api), [api]);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(memory.text);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(work: () => Promise<void>, done: string) {
    setBusy(true);
    setError("");
    try {
      await work();
      notify(done);
      if (done === "Memory forgotten.") deboMood.emit({ type: "deleted" });
      await onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ gap: 12, padding: 16 }}>
      {editing ? (
        <>
          <Field label="Fix this memory" value={text} onChangeText={setText} multiline maxLength={1000} />
          <View style={[s.row, { gap: 10, flexWrap: "wrap" }]}>
            <Button
              primary
              busy={busy}
              disabled={!text.trim()}
              onPress={() =>
                void run(async () => {
                  await debo.fixMemory(memory.id, text);
                  setEditing(false);
                }, "Memory fixed.")
              }
            >
              Save fix
            </Button>
            <Button
              disabled={busy}
              onPress={() => {
                setText(memory.text);
                setEditing(false);
              }}
            >
              Not now
            </Button>
          </View>
        </>
      ) : (
        <Text selectable style={s.text}>
          {memory.text}
        </Text>
      )}
      {memory.editedByUser && !editing && <Text style={s.small}>You fixed this memory.</Text>}
      <SourceChips sources={[memory.source]} />
      <ErrorNotice error={error} />
      {!editing && !confirming && (
        <View style={[s.row, { gap: 10, flexWrap: "wrap" }]}>
          <Button
            small
            icon={Pencil}
            onPress={() => {
              setText(memory.text);
              setEditing(true);
            }}
          >
            Fix this memory
          </Button>
          <Button small danger icon={Trash2} onPress={() => setConfirming(true)}>
            Forget this memory
          </Button>
        </View>
      )}
      {confirming && (
        <View accessibilityRole="alert" style={{ gap: 10 }}>
          <Text style={s.text}>
            Forget this memory for good? Your entry stays. Debo will not remember this fact from it.
          </Text>
          <View style={[s.row, { gap: 10, flexWrap: "wrap" }]}>
            <Button
              danger
              busy={busy}
              icon={Trash2}
              onPress={() => void run(() => debo.forgetMemory(memory.id), "Memory forgotten.")}
            >
              Yes, forget it
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
