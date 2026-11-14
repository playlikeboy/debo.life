// The journal's writing surface: one calm box that grows as you write, a quiet
// "saved on this device" line and word count, and three ways to add more than
// typing: Speak (dictate into the text), Record (a voice or video note), and
// Add a recording (a file you already have).
//
// Plain text, on purpose. The rich-text editors that work on both web and phone
// need a custom native build or run inside a web view, which is fragile; a
// plain text box is the same everywhere and never loses a word. See
// os/docs/JOURNAL-MEDIA.md.
import { Check, Mic, Paperclip, Square, Video } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import { deboApi, errorText } from "./debo-api";
import { type Dictation, recordingSupport, startDictation } from "./debo-capture";
import { type DeboStatus, type EntryView, happenedAtFor, todayInput, wordCountLabel } from "./debo-data";
import { DayField } from "./debo-day-field";
import { readStoredDraft, writeStoredDraft } from "./debo-draft-store";
import { RecordingPanel } from "./debo-recording-panel";
import { Button, Card, colors, ErrorNotice, fontSize, radius, s, spacing } from "./ui";
import { useWorkspace } from "./workspace";

const MIN_HEIGHT = spacing[12] * 3;
const CONSENT_KEY = "debo.dictation.ok.v1";

function consentGiven(): boolean {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage?.getItem(CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}
function rememberConsent() {
  try {
    (globalThis as { localStorage?: Storage }).localStorage?.setItem(CONSENT_KEY, "1");
  } catch {
    // Without storage the question is simply asked again next time.
  }
}

export function Composer({ status, onSaved }: { status: DeboStatus; onSaved: () => Promise<void> }) {
  const { api, notify } = useWorkspace();
  const debo = useMemo(() => deboApi(api), [api]);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [draftState, setDraftState] = useState<"idle" | "saving" | "saved">("idle");
  const [day, setDay] = useState(todayInput());
  const [dayOpen, setDayOpen] = useState(false);
  const [height, setHeight] = useState(MIN_HEIGHT);
  const [focused, setFocused] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<"record" | "pick">();
  const [listening, setListening] = useState(false);
  const [writing, setWriting] = useState(0);
  const [asking, setAsking] = useState(false);
  const dictation = useRef<Dictation | undefined>(undefined);
  const selection = useRef({ start: 0, end: 0 });
  const textRef = useRef("");
  const support = recordingSupport();

  // Bring back what was written last time.
  useEffect(() => {
    void readStoredDraft().then((saved) => {
      if (saved && !textRef.current) {
        textRef.current = saved;
        setText(saved);
      }
      setLoaded(true);
    });
  }, []);

  // Keep the draft on this device, a moment after the last key.
  useEffect(() => {
    if (!loaded) return;
    setDraftState(text ? "saving" : "idle");
    const timer = setTimeout(() => {
      void writeStoredDraft(text).then(() => setDraftState(text ? "saved" : "idle"));
    }, 400);
    return () => clearTimeout(timer);
  }, [text, loaded]);

  // Leaving the screen always turns the microphone off.
  useEffect(
    () => () => {
      void dictation.current?.stop();
    },
    [],
  );

  const change = useCallback((next: string) => {
    textRef.current = next;
    setText(next);
  }, []);

  /** Put spoken words at the cursor (or at the end), with a space around them when needed. */
  const insert = useCallback(
    (words: string) => {
      const clean = words.trim();
      if (!clean) return;
      const current = textRef.current;
      const at = Math.min(selection.current.end, current.length);
      const before = current.slice(0, at);
      const after = current.slice(at);
      const lead = before && !/\s$/.test(before) ? " " : "";
      const trail = after && !/^\s/.test(after) ? " " : "";
      const next = `${before}${lead}${clean}${trail}${after}`;
      const cursor = before.length + lead.length + clean.length;
      selection.current = { start: cursor, end: cursor };
      change(next);
    },
    [change],
  );

  async function startSpeaking() {
    setError("");
    if (!status.speaking) {
      setError("Speaking into the text is not turned on yet. You can still type, or use the microphone on your keyboard.");
      return;
    }
    if (!support.dictation) {
      notify("Use the microphone on your keyboard to speak into the text.");
      return;
    }
    if (!consentGiven()) {
      setAsking(true);
      return;
    }
    setAsking(false);
    try {
      dictation.current = await startDictation(async (clip) => {
        setWriting((n) => n + 1);
        try {
          insert(await debo.dictate(clip));
        } catch (e) {
          setError(errorText(e));
        } finally {
          setWriting((n) => n - 1);
        }
      });
      setListening(true);
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function stopSpeaking() {
    const active = dictation.current;
    dictation.current = undefined;
    setListening(false);
    await active?.stop();
  }

  async function save() {
    if (!text.trim() || saving) return;
    if (listening) await stopSpeaking();
    setSaving(true);
    setError("");
    try {
      await debo.addEntry(textRef.current, happenedAtFor(day));
      change("");
      selection.current = { start: 0, end: 0 };
      setDay(todayInput());
      setDayOpen(false);
      await writeStoredDraft("");
      notify("Entry saved.");
      await onSaved();
    } catch (e) {
      // The draft stays, so nothing the person wrote is lost.
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  const isToday = day === todayInput();
  const busyWriting = writing > 0;

  return (
    <View style={{ gap: spacing[3] }}>
      <Card
        style={{
          gap: spacing[3],
          padding: spacing[5],
          borderWidth: focused ? 2 : 1,
          borderColor: focused ? colors.blueDark : colors.line,
        }}
      >
        <TextInput
          accessibilityLabel="Write an entry"
          accessibilityHint="Press Control or Command and Enter to save."
          value={text}
          onChangeText={change}
          onSelectionChange={(e) => {
            selection.current = e.nativeEvent.selection;
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onContentSizeChange={(e) => setHeight(Math.max(MIN_HEIGHT, Math.ceil(e.nativeEvent.contentSize.height)))}
          onKeyPress={(e) => {
            // Web only: Control or Command with Enter saves. The event carries the modifier keys there.
            const key = e.nativeEvent as unknown as { key: string; ctrlKey?: boolean; metaKey?: boolean };
            if (key.key === "Enter" && (key.ctrlKey || key.metaKey)) void save();
          }}
          multiline
          scrollEnabled={false}
          maxLength={20000}
          placeholder="What happened today? Who did you see? The first line becomes the title."
          placeholderTextColor={colors.muted}
          style={[
            s.text,
            {
              fontSize: fontSize.lg,
              lineHeight: spacing[7],
              minHeight: MIN_HEIGHT,
              height,
              padding: 0,
              textAlignVertical: "top",
              ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}),
            },
          ]}
        />

        <View style={[s.between, { gap: spacing[3], flexWrap: "wrap" }]}>
          <Text style={s.small} accessibilityLiveRegion="polite">
            {draftState === "saving" ? "Saving…" : draftState === "saved" ? "Saved on this device" : "Nothing saved yet"}
          </Text>
          <Text style={s.small}>{wordCountLabel(text)}</Text>
        </View>

        {listening && (
          <View
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={[s.row, { gap: spacing[3], flexWrap: "wrap", padding: spacing[3], borderRadius: radius.container, backgroundColor: colors.blue }]}
          >
            <Mic size={18} color={colors.blueText} />
            <Text style={[s.text, { color: colors.blueText, flex: 1, minWidth: 140 }]}>
              {busyWriting ? "Listening. Writing out what you said…" : "Listening. Speak now."}
            </Text>
            <Button primary small icon={Square} onPress={() => void stopSpeaking()}>
              Stop
            </Button>
          </View>
        )}
        {!listening && busyWriting && <Text style={s.small}>Writing out what you said…</Text>}

        {asking && (
          <View accessibilityRole="alert" style={{ gap: spacing[2], padding: spacing[3], borderRadius: radius.container, backgroundColor: colors.subtle }}>
            <Text style={s.text}>
              Speak sends short clips of your voice to Debo, which uses Cloudflare's speech service to write them out as text.
              Nothing is kept. The microphone is only on while you see “Listening”.
            </Text>
            <View style={[s.row, { gap: spacing[2], flexWrap: "wrap" }]}>
              <Button
                primary
                icon={Mic}
                onPress={() => {
                  rememberConsent();
                  void startSpeaking();
                }}
              >
                Start listening
              </Button>
              <Button onPress={() => setAsking(false)}>Not now</Button>
            </View>
          </View>
        )}

        {(status.recordings || status.speaking) && (
          <View accessibilityRole="toolbar" style={[s.row, { gap: spacing[2], flexWrap: "wrap" }]}>
            {status.speaking && (
              <Button icon={Mic} disabled={listening} onPress={() => void startSpeaking()}>
                Speak
              </Button>
            )}
            {status.recordings && (
              <>
                <Button icon={Video} disabled={listening} onPress={() => setPanel("record")}>
                  Record
                </Button>
                <Button icon={Paperclip} disabled={listening} onPress={() => setPanel("pick")}>
                  Add a recording
                </Button>
              </>
            )}
          </View>
        )}
      </Card>

      {panel && (
        <RecordingPanel
          key={panel}
          mode={panel}
          status={status}
          onClose={() => setPanel(undefined)}
          onSaved={() => {
            setPanel(undefined);
            void onSaved();
          }}
        />
      )}

      <ErrorNotice error={error} />

      <View style={[s.between, { gap: spacing[3], flexWrap: "wrap" }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isToday ? "When did this happen? Today. Change the day." : `When did this happen? ${day}. Change the day.`}
          onPress={() => setDayOpen(!dayOpen)}
          style={{ minHeight: spacing[11], justifyContent: "center" }}
        >
          <Text style={[s.small, { color: colors.blueDark, fontWeight: "600" }]}>
            {isToday ? "Happened today" : `Happened ${day}`} · {dayOpen ? "Done" : "Change the day"}
          </Text>
        </Pressable>
        <Button primary icon={Check} busy={saving} disabled={!text.trim()} onPress={() => void save()}>
          Save entry
        </Button>
      </View>
      {dayOpen && <DayField value={day} onChange={setDay} />}
      {Platform.OS === "web" && <Text style={s.small}>Tip: press Ctrl or ⌘ with Enter to save.</Text>}
    </View>
  );
}
