// "Talk to Debo": a voice conversation, with captions, source chips and a
// text box so voice is never the only way. The connection lives in
// debo-voice-engine.ts; this file is only the screen.
import { Mic, MicOff } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Text, View } from "react-native";
import {
  type AgentState,
  startProblem,
  startVoice,
  type VoiceChip,
  type VoiceConnection,
} from "./debo-voice-engine";
import { Button, Card, Chip, colors, ErrorNotice, Field, s } from "./ui";
import { useWorkspace } from "./workspace";

type Status = "idle" | "connecting" | "live" | "ended" | "error";
interface Line {
  id: string;
  who: "you" | "debo";
  text: string;
  sources: VoiceChip[];
}

const agentWords: Record<string, string> = {
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  initializing: "Getting ready",
};

export function TalkScreen() {
  const { api } = useWorkspace();
  const [status, setStatus] = useState<Status>("idle");
  const [problem, setProblem] = useState("");
  const [micOn, setMicOn] = useState(false);
  const [agentState, setAgentState] = useState<AgentState>("");
  const [lines, setLines] = useState<Line[]>([]);
  const [typed, setTyped] = useState("");
  const connection = useRef<VoiceConnection | undefined>(undefined);
  const reduceMotion = useReducedMotion();

  // Leaving the screen ends the conversation, so the microphone is never left on by accident.
  useEffect(
    () => () => {
      void connection.current?.end().catch(() => {});
      connection.current = undefined;
    },
    [],
  );

  const upsert = useCallback((id: string, who: Line["who"], text: string) => {
    setLines((all) => {
      const at = all.findIndex((line) => line.id === id);
      if (at === -1) return [...all, { id, who, text, sources: [] }];
      return all.map((line, i) => (i === at ? { ...line, text } : line));
    });
  }, []);

  // Sources belong to Debo's answer to the latest question. Show them right under it.
  const attachSources = useCallback((chips: VoiceChip[]) => {
    setLines((all) => {
      const lastYou = all.map((line) => line.who).lastIndexOf("you");
      if (lastYou === -1 || chips.length === 0) return all;
      const next = [...all];
      next.splice(lastYou + 1, 0, { id: `sources-${Date.now()}`, who: "debo", text: "", sources: chips });
      return next;
    });
  }, []);

  async function start() {
    setProblem("");
    setStatus("connecting");
    try {
      const next = await startVoice(api, {
        onLine: (id, who, text) => upsert(id, who, text),
        onSources: attachSources,
        onAgentState: setAgentState,
        onEnded: () => {
          connection.current = undefined;
          setMicOn(false);
          setStatus((now) => (now === "error" ? now : "ended"));
        },
      });
      connection.current = next;
      setMicOn(!next.microphoneBlocked);
      if (next.microphoneBlocked)
        setProblem(
          "Debo can't use your microphone. Allow it in your settings, or type to Debo below.",
        );
      setStatus("live");
    } catch (error) {
      setMicOn(false);
      setStatus("error");
      setProblem(startProblem(error));
    }
  }

  async function end() {
    await connection.current?.end().catch(() => {});
    connection.current = undefined;
    setMicOn(false);
    setStatus("ended");
  }

  async function toggleMicrophone() {
    const next = !micOn;
    try {
      await connection.current?.setMicrophone(next);
      setMicOn(next);
      setProblem("");
    } catch {
      setMicOn(false);
      setProblem("Debo can't use your microphone. Allow it in your settings, or type to Debo below.");
    }
  }

  async function send() {
    const text = typed.trim();
    if (!text || !connection.current) return;
    setTyped("");
    upsert(`typed-${Date.now()}`, "you", text);
    await connection.current.sendText(text).catch(() => {
      setProblem("That message didn't send. Try again.");
    });
  }

  const live = status === "live";
  const statusLine =
    status === "idle"
      ? "Microphone off. Debo is not listening."
      : status === "connecting"
        ? "Connecting. Microphone off for now."
        : status === "ended"
          ? "Conversation ended. Microphone off."
          : status === "error"
            ? "Not connected. Microphone off."
            : micOn
              ? `Microphone on. ${agentWords[agentState] ?? "Waiting for Debo to join"}.`
              : "Microphone off. Debo can't hear you, but you can type.";
  const listening = live && micOn;

  return (
    <View style={{ gap: 18 }} accessibilityLabel="Talk to Debo">
      <Card style={{ gap: 14 }}>
        <View
          accessible
          accessibilityRole="text"
          accessibilityLiveRegion="polite"
          accessibilityLabel={statusLine}
          style={[s.row, { gap: 10, alignItems: "flex-start" }]}
        >
          <Pulse active={listening && agentState === "listening"} still={reduceMotion}>
            {listening ? (
              <Mic size={18} color={colors.blueDark} />
            ) : (
              <MicOff size={18} color={colors.muted} />
            )}
          </Pulse>
          <Text style={[s.heading, { flex: 1, flexShrink: 1 }]}>{statusLine}</Text>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {!live && status !== "connecting" && (
            <Button primary icon={Mic} onPress={start}>
              {status === "idle" ? "Start talking" : "Start again"}
            </Button>
          )}
          {status === "connecting" && (
            <Button busy onPress={() => {}}>
              Connecting
            </Button>
          )}
          {live && (
            <>
              <Button primary onPress={() => void connection.current?.stopDebo()} disabled={agentState !== "speaking"}>
                Stop Debo
              </Button>
              <Button icon={micOn ? MicOff : Mic} onPress={toggleMicrophone}>
                {micOn ? "Turn microphone off" : "Turn microphone on"}
              </Button>
              <Button onPress={end}>End conversation</Button>
            </>
          )}
        </View>

        {status === "idle" && (
          <Text style={s.muted}>
            When you press Start talking, your phone or browser will ask to use the microphone.
            Debo listens only while the conversation is on, and the microphone status above always
            tells you. Debo does not keep your voice recording. You can end the conversation, or
            turn the microphone off, at any time. You can also type to Debo instead.
          </Text>
        )}
        <ErrorNotice error={problem} />
      </Card>

      {lines.some((line) => line.text || line.sources.length > 0) && (
        <View
          accessibilityRole="list"
          accessibilityLabel="What was said"
          accessibilityLiveRegion="polite"
          style={{ gap: 10 }}
        >
          {lines
            .filter((line) => line.text || line.sources.length > 0)
            .map((line) => (
              <Card
                key={line.id}
                style={{
                  padding: 14,
                  gap: 6,
                  backgroundColor: line.who === "you" ? colors.sky : colors.card,
                }}
              >
                {line.text ? (
                  <>
                    <Text style={s.small}>{line.who === "you" ? "You" : "Debo"}</Text>
                    <Text style={[s.text, { flexShrink: 1 }]}>{line.text}</Text>
                  </>
                ) : null}
                {line.sources.length > 0 && (
                  <View
                    accessibilityRole="list"
                    accessibilityLabel="Where this answer came from"
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                  >
                    {line.sources.map((source) => (
                      <Chip key={source.id} tint={colors.green}>
                        {source.label}
                      </Chip>
                    ))}
                  </View>
                )}
              </Card>
            ))}
        </View>
      )}

      {live && (
        <View style={{ gap: 4 }}>
          <Field
            label="Type to Debo instead"
            value={typed}
            onChangeText={setTyped}
            maxLength={500}
            placeholder="Or type here"
            returnKeyType="send"
            onSubmitEditing={() => void send()}
          />
          <Button onPress={() => void send()} disabled={!typed.trim()}>
            Send message
          </Button>
        </View>
      )}
    </View>
  );
}

/** A soft pulse while Debo listens. It stays still when the person asked for less motion. */
function Pulse({
  active,
  still,
  children,
}: {
  active: boolean;
  still: boolean;
  children: React.ReactNode;
}) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active || still) {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: 900, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, still, opacity]);
  return (
    <Animated.View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{ opacity, paddingTop: 2 }}
    >
      {children}
    </Animated.View>
  );
}

function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => live && setReduce(value));
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduce;
}
