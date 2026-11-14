// "Talk to Debo": a full-screen voice popup that opens over any screen, like a
// modern voice assistant. Debo's tomato face is the orb in the middle. A soft halo
// swells with her voice and a ring answers the person's microphone. Under her, the
// state is written in words, so the face is never the only signal. The controls sit
// in one row: microphone, Stop Debo, keyboard and a clear red End. Voice is never
// the only way: the keyboard button slides up a text box.
//
// The connection itself lives in debo-voice-engine.ts. Closing the popup ends the
// conversation and turns the microphone off, always.
import { ChevronDown, Keyboard, MessageCircle, Mic, MicOff, Phone, Square } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { duration } from "./astryx-tokens";
import { DeboFace, useReducedMotion } from "./debo-face";
import { deboLevels, deboMood } from "./debo-mood-store";
import {
  type AgentState,
  startProblem,
  startVoice,
  type VoiceChip,
  type VoiceConnection,
  type VoiceLevels,
} from "./debo-voice-engine";
import { Button, Card, Chip, colors, ErrorNotice, Field, fontSize, radius, s, spacing } from "./ui";
import { useWorkspace } from "./workspace";

type Status = "idle" | "connecting" | "live" | "ended" | "error";
interface Line {
  id: string;
  who: "you" | "debo";
  text: string;
  sources: VoiceChip[];
}

/** The words under Debo. Short, and always true to what is happening. */
export function stateWords(input: {
  status: Status;
  micOn: boolean;
  agentState: AgentState;
  reconnecting: boolean;
}): string {
  const { status, micOn, agentState, reconnecting } = input;
  if (status === "idle") return "Tap to start";
  if (status === "connecting") return "Connecting…";
  if (status === "ended") return "Conversation ended";
  if (status === "error") return "Not connected";
  if (reconnecting) return "Trying to reconnect…";
  if (agentState === "speaking") return "Debo is speaking";
  if (agentState === "thinking") return "Thinking…";
  if (!micOn) return "Microphone off";
  if (agentState === "listening") return "Listening";
  return "Getting ready…";
}

/** What a screen reader hears. It says the microphone state every time. */
function spokenStatus(input: {
  status: Status;
  micOn: boolean;
  agentState: AgentState;
  reconnecting: boolean;
}): string {
  const { status, micOn, agentState, reconnecting } = input;
  const agentWords: Record<string, string> = {
    listening: "Listening",
    thinking: "Thinking",
    speaking: "Speaking",
    initializing: "Getting ready",
  };
  return status === "idle"
    ? "Microphone off. Debo is not listening."
    : status === "connecting"
      ? "Connecting. Microphone off for now."
      : status === "ended"
        ? "Conversation ended. Microphone off."
        : status === "error"
          ? "Not connected. Microphone off."
          : reconnecting
            ? "Trying to reconnect."
            : micOn
              ? `Microphone on. ${agentWords[agentState] ?? "Waiting for Debo to join"}.`
              : "Microphone off. Debo can't hear you, but you can type.";
}

export function TalkPopup({ onClose }: { onClose: () => void }) {
  const { api, navigate, notify } = useWorkspace();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [status, setStatus] = useState<Status>("idle");
  const [problem, setProblem] = useState("");
  const [micOn, setMicOn] = useState(false);
  const [agentState, setAgentState] = useState<AgentState>("");
  const [reconnecting, setReconnecting] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [typed, setTyped] = useState("");
  const [typing, setTyping] = useState(false);
  const [transcript, setTranscript] = useState(false);
  const [youActive, setYouActive] = useState(false);
  const connection = useRef<VoiceConnection | undefined>(undefined);
  const closing = useRef(false);
  const youActiveRef = useRef(false);

  const live = status === "live";
  const listening = live && micOn;

  // Motion values: the popup rising, the keyboard panel, the transcript panel, the halo pulse.
  const enter = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const keyboardIn = useRef(new Animated.Value(0)).current;
  const transcriptIn = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const native = Platform.OS !== "web";

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: reduceMotion ? duration.fast : duration.medium,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: native,
    }).start();
  }, [enter, native, reduceMotion]);
  useEffect(() => {
    Animated.timing(keyboardIn, {
      toValue: typing ? 1 : 0,
      duration: reduceMotion ? duration.fast : duration.medium,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: native,
    }).start();
  }, [typing, keyboardIn, native, reduceMotion]);
  useEffect(() => {
    Animated.timing(transcriptIn, {
      toValue: transcript ? 1 : 0,
      duration: reduceMotion ? duration.fast : duration.medium,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: native,
    }).start();
  }, [transcript, transcriptIn, native, reduceMotion]);
  // A slow swell while she listens. It stops with reduced motion.
  useEffect(() => {
    if (!listening || reduceMotion || agentState === "speaking") {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        Animated.timing(pulse, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [listening, reduceMotion, agentState, pulse, native]);

  // The face follows the conversation. The privacy text keeps her calm until the person starts.
  useEffect(() => {
    deboMood.serious(status === "idle");
    return () => deboMood.serious(false);
  }, [status]);
  useEffect(() => {
    const state = agentState === "initializing" ? "" : agentState;
    deboMood.emit({
      type: "voice",
      state: live && reconnecting === false && state ? state : "idle",
    });
  }, [agentState, live, reconnecting]);

  const endConversation = useCallback(async () => {
    const open = connection.current;
    connection.current = undefined;
    await open?.end().catch(() => {});
    setMicOn(false);
    deboLevels.debo.setValue(0);
    deboLevels.you.setValue(0);
    deboLevels.real.setValue(0);
  }, []);

  // Leaving the popup, for any reason, ends the conversation, so the microphone is never left on.
  useEffect(
    () => () => {
      const open = connection.current;
      connection.current = undefined;
      void open?.end().catch(() => {});
      deboLevels.debo.setValue(0);
      deboLevels.you.setValue(0);
      deboLevels.real.setValue(0);
    },
    [],
  );

  // Put focus back where it was when the popup closes (web).
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const before = globalThis.document?.activeElement as HTMLElement | null;
    return () => before?.focus?.();
  }, []);

  const requestClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const hadSession = connection.current !== undefined;
    void endConversation();
    Animated.timing(enter, {
      toValue: 0,
      duration: reduceMotion ? duration.fast : duration.exit + 100,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: native,
    }).start(() => {
      if (hadSession) notify("Conversation ended. Microphone off.");
      onClose();
    });
  }, [endConversation, enter, native, notify, onClose, reduceMotion]);

  // Escape closes the popup (web).
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (transcript) setTranscript(false);
      else if (typing) setTyping(false);
      else requestClose();
    };
    globalThis.document?.addEventListener("keydown", onKey);
    return () => globalThis.document?.removeEventListener("keydown", onKey);
  }, [requestClose, transcript, typing]);

  // Swipe down closes.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dy > 12 && g.dy > Math.abs(g.dx) * 1.5,
        onPanResponderMove: (_e, g) => drag.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_e, g) => {
          if (g.dy > 120 || g.vy > 0.9) requestClose();
          else Animated.spring(drag, { toValue: 0, useNativeDriver: false, friction: 8 }).start();
        },
        onPanResponderTerminate: () =>
          Animated.spring(drag, { toValue: 0, useNativeDriver: false, friction: 8 }).start(),
      }),
    [drag, requestClose],
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

  const onLevels = useCallback((levels: VoiceLevels) => {
    deboLevels.debo.setValue(levels.debo);
    deboLevels.you.setValue(levels.you);
    deboLevels.real.setValue(levels.real ? 1 : 0);
    const active = youActiveRef.current ? levels.you > 0.04 : levels.you > 0.1;
    if (active !== youActiveRef.current) {
      youActiveRef.current = active;
      setYouActive(active);
    }
  }, []);

  async function start() {
    if (status === "connecting" || live) return;
    setProblem("");
    setStatus("connecting");
    try {
      const next = await startVoice(api, {
        onLine: (id, who, text) => upsert(id, who, text),
        onSources: attachSources,
        onAgentState: setAgentState,
        onLevels,
        onConnection: (state) => setReconnecting(state === "reconnecting"),
        onEnded: () => {
          connection.current = undefined;
          setMicOn(false);
          setReconnecting(false);
          setStatus((now) => (now === "error" ? now : "ended"));
        },
      });
      if (closing.current) {
        void next.end().catch(() => {});
        return;
      }
      connection.current = next;
      setMicOn(!next.microphoneBlocked);
      if (next.microphoneBlocked) {
        setProblem(
          "Debo can't use your microphone. Allow it in your settings, or type to Debo below.",
        );
        setTyping(true);
      }
      setStatus("live");
    } catch (error) {
      setMicOn(false);
      setStatus("error");
      setProblem(startProblem(error));
    }
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

  const words = stateWords({ status, micOn, agentState, reconnecting });
  const spoken = spokenStatus({ status, micOn, agentState, reconnecting });
  const shown = lines.filter((line) => line.text);
  const recent = shown.slice(-2);
  const latestSources = [...lines].reverse().find((line) => line.sources.length > 0)?.sources ?? [];

  // Sizes work from 320px up. On desktop the column stays centred.
  const column = Math.min(width, 560);
  const orb = Math.max(150, Math.min(250, column - 96, height * 0.34));
  const face = orb * 0.82;

  const haloScale = Animated.add(
    deboLevels.debo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.32] }),
    pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.06] }),
  );
  const ringScale = deboLevels.you.interpolate({ inputRange: [0, 1], outputRange: [1.04, 1.28] });
  const slide = enter.interpolate({ inputRange: [0, 1], outputRange: [Math.min(height, 900), 0] });
  const keyboardShift = keyboardIn.interpolate({ inputRange: [0, 1], outputRange: [90, 0] });
  const transcriptShift = transcriptIn.interpolate({ inputRange: [0, 1], outputRange: [Math.min(height, 900), 0] });

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={requestClose}>
      <Animated.View
        style={{ flex: 1, backgroundColor: colors.scrim, opacity: enter }}
        pointerEvents="none"
      />
      <Animated.View
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, transform: [{ translateY: drag }] }}
      >
        <Animated.View
          accessibilityViewIsModal
          role={Platform.OS === "web" ? "dialog" : undefined}
          aria-modal={Platform.OS === "web" ? true : undefined}
          aria-label="Talk to Debo"
          accessibilityLabel="Talk to Debo"
          {...pan.panHandlers}
          style={{
            flex: 1,
            backgroundColor: colors.canvas,
            alignItems: "center",
            paddingTop: insets.top + spacing[2],
            paddingBottom: Math.max(insets.bottom, spacing[4]),
            transform: [{ translateY: slide }],
          }}
        >
          <View style={{ flex: 1, width: "100%", maxWidth: 560, paddingHorizontal: spacing[5] }}>
            {/* Top: grab handle, and the transcript button. */}
            <View style={[s.between, { minHeight: spacing[11] }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close and end the conversation. Microphone turns off."
                onPress={requestClose}
                style={{ width: spacing[11], height: spacing[11], alignItems: "center", justifyContent: "center" }}
              >
                <ChevronDown size={24} color={colors.muted} strokeWidth={1.8} />
              </Pressable>
              <View
                style={{ width: 40, height: 4, borderRadius: radius.full, backgroundColor: colors.lineStrong }}
              />
              {live || shown.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: transcript }}
                  onPress={() => setTranscript(!transcript)}
                  style={{ minHeight: spacing[11], justifyContent: "center", paddingHorizontal: spacing[2] }}
                >
                  <Text style={[s.small, { color: colors.blueDark, fontWeight: "600" }]}>
                    {transcript ? "Hide transcript" : "Show transcript"}
                  </Text>
                </Pressable>
              ) : (
                <View style={{ width: spacing[11] }} />
              )}
            </View>

            {/* The orb: Debo, a halo that follows her voice, and a ring that follows yours. */}
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing[3] }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={live ? "Debo" : "Start talking"}
                disabled={live || status === "connecting"}
                onPress={() => void start()}
                style={{ width: orb * 1.4, height: orb * 1.4, alignItems: "center", justifyContent: "center" }}
              >
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    width: orb,
                    height: orb,
                    borderRadius: radius.full,
                    backgroundColor: colors.blue,
                    opacity: agentState === "speaking" ? 0.9 : 0.55,
                    transform: [{ scale: reduceMotion ? 1.1 : haloScale }],
                  }}
                />
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    width: orb * 1.08,
                    height: orb * 1.08,
                    borderRadius: radius.full,
                    borderWidth: 3,
                    borderColor: colors.blueDark,
                    opacity: listening && youActive ? 0.8 : 0,
                    transform: [{ scale: reduceMotion ? 1.12 : ringScale }],
                  }}
                />
                <DeboFace size={face} interactive={live} />
              </Pressable>

              <View
                accessible
                accessibilityRole="text"
                accessibilityLiveRegion="polite"
                accessibilityLabel={spoken}
                style={{ alignItems: "center", gap: spacing[2] }}
              >
                <Text style={[s.title, { textAlign: "center" }]}>{words}</Text>
                <View style={[s.row, { gap: spacing[1.5] }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                  {listening ? (
                    <Mic size={14} color={colors.blueDark} />
                  ) : (
                    <MicOff size={14} color={colors.muted} />
                  )}
                  <Text style={s.small}>{listening ? "Microphone on" : "Microphone off"}</Text>
                </View>
              </View>

              {status === "idle" && (
                <View style={{ gap: spacing[3], alignItems: "center" }}>
                  <Text style={[s.muted, { textAlign: "center", fontSize: fontSize.base }]}>
                    When you press Start talking, your phone or browser will ask to use the microphone.
                    Debo listens only while the conversation is on, and the microphone status above always
                    tells you. Debo does not keep your voice recording. You can end the conversation, or
                    turn the microphone off, at any time. You can also type to Debo instead.
                  </Text>
                  <View style={[s.row, { gap: spacing[3] }]}>
                    <Button primary icon={Mic} onPress={() => void start()}>
                      Start talking
                    </Button>
                    <Button onPress={requestClose}>Not now</Button>
                  </View>
                </View>
              )}

              {(status === "ended" || status === "error") && (
                <View style={[s.row, { gap: spacing[3], flexWrap: "wrap", justifyContent: "center" }]}>
                  <Button primary icon={Mic} onPress={() => void start()}>
                    {status === "error" ? "Try again" : "Start again"}
                  </Button>
                  {status === "error" && (
                    <Button
                      icon={MessageCircle}
                      onPress={() => {
                        requestClose();
                        navigate("chat");
                      }}
                    >
                      Type in Chat instead
                    </Button>
                  )}
                </View>
              )}

              <ErrorNotice error={problem} />

              {/* Live captions: the last one or two lines, the older one faded. */}
              {recent.length > 0 && (
                <View accessibilityLiveRegion="polite" accessibilityLabel="Live captions" style={{ gap: spacing[1], alignSelf: "stretch" }}>
                  {recent.map((line, i) => (
                    <Caption key={line.id} line={line} faded={recent.length === 2 && i === 0} />
                  ))}
                </View>
              )}
              {latestSources.length > 0 && (
                <View
                  accessibilityRole="list"
                  accessibilityLabel="Where this answer came from"
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2], justifyContent: "center" }}
                >
                  {latestSources.map((source) => (
                    <Chip key={source.id} tint={colors.green}>
                      {source.label}
                    </Chip>
                  ))}
                </View>
              )}
            </View>

            {/* The keyboard panel slides up above the controls. */}
            {live && typing && (
              <Animated.View
                style={{
                  opacity: keyboardIn,
                  transform: [{ translateY: keyboardShift }],
                  marginBottom: spacing[3],
                }}
              >
                <Field
                  label="Type to Debo instead"
                  value={typed}
                  onChangeText={setTyped}
                  maxLength={500}
                  placeholder="Or type here"
                  returnKeyType="send"
                  autoFocus
                  onSubmitEditing={() => void send()}
                />
                <Button onPress={() => void send()} disabled={!typed.trim()}>
                  Send message
                </Button>
              </Animated.View>
            )}

            {/* Controls: microphone, Stop Debo, keyboard, End. */}
            {(live || status === "connecting") && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingBottom: spacing[2] }}>
                <RoundButton
                  label="Microphone"
                  caption={micOn ? "Mic on" : "Mic off"}
                  checked={micOn}
                  disabled={!live}
                  onPress={() => void toggleMicrophone()}
                  icon={micOn ? Mic : MicOff}
                />
                <RoundButton
                  label="Stop Debo"
                  caption="Stop Debo"
                  disabled={!live || agentState !== "speaking"}
                  onPress={() => void connection.current?.stopDebo()}
                  icon={Square}
                />
                <RoundButton
                  label="Type to Debo"
                  caption="Type"
                  expanded={typing}
                  disabled={!live}
                  onPress={() => setTyping(!typing)}
                  icon={Keyboard}
                />
                <RoundButton
                  label="End conversation"
                  caption="End"
                  danger
                  onPress={requestClose}
                  icon={Phone}
                />
              </View>
            )}
          </View>

          {/* The full transcript slides over everything. */}
          <Animated.View
            pointerEvents={transcript ? "auto" : "none"}
            accessibilityElementsHidden={!transcript}
            importantForAccessibility={transcript ? "auto" : "no-hide-descendants"}
            style={{
              position: "absolute",
              top: insets.top + spacing[2],
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              backgroundColor: colors.canvas,
              opacity: transcriptIn,
              transform: [{ translateY: transcriptShift }],
            }}
          >
            <View style={{ flex: 1, width: "100%", maxWidth: 560, paddingHorizontal: spacing[5] }}>
              <View style={[s.between, { minHeight: spacing[11] }]}>
                <Text style={s.heading}>Transcript</Text>
                <Button small onPress={() => setTranscript(false)}>
                  Hide transcript
                </Button>
              </View>
              <ScrollView contentContainerStyle={{ gap: spacing[3], paddingVertical: spacing[3] }}>
                {shown.length === 0 && latestSources.length === 0 && (
                  <Text style={s.muted}>Nothing has been said yet.</Text>
                )}
                {lines
                  .filter((line) => line.text || line.sources.length > 0)
                  .map((line) => (
                    <Card
                      key={line.id}
                      style={{
                        padding: spacing[3],
                        gap: spacing[1.5],
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
                          style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}
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
              </ScrollView>
            </View>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

/** One caption line. It fades in when it appears and dims when a newer line arrives. */
function Caption({ line, faded }: { line: Line; faded: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: faded ? 0.45 : 1,
      duration: duration.medium,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [faded, opacity]);
  return (
    <Animated.View style={{ opacity }}>
      <Text numberOfLines={3} style={[s.text, { textAlign: "center", fontSize: fontSize.lg }]}>
        <Text style={s.small}>{line.who === "you" ? "You: " : ""}</Text>
        {line.text}
      </Text>
    </Animated.View>
  );
}

function RoundButton({
  label,
  caption,
  icon: Icon,
  onPress,
  disabled,
  danger,
  checked,
  expanded,
}: {
  label: string;
  caption: string;
  icon: typeof Mic;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  checked?: boolean;
  expanded?: boolean;
}) {
  const tint = danger ? colors.onStop : colors.text;
  return (
    <View style={{ alignItems: "center", gap: spacing[1.5], width: 72, opacity: disabled ? 0.45 : 1 }}>
      <Pressable
        accessibilityRole={checked === undefined ? "button" : "switch"}
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled, checked, expanded }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => ({
          width: 64,
          height: 64,
          borderRadius: radius.full,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: danger ? colors.stop : checked || expanded ? colors.blue : colors.subtle,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        })}
      >
        <Icon
          size={26}
          strokeWidth={1.8}
          color={tint}
          // The hang-up phone points down so it reads as "end".
          style={danger ? { transform: [{ rotate: "135deg" }] } : undefined}
        />
      </Pressable>
      <Text style={[s.small, { color: colors.text, textAlign: "center" }]}>{caption}</Text>
    </View>
  );
}
