// Debo's face: the red tomato from docs/assets/debo.svg, drawn in code and alive.
//
// How it works. The tomato is a stack of small SVG layers (react-native-svg), each
// inside an Animated.View. Every layer moves only with transform and opacity, so
// on phones the animation runs on the native driver and never touches layout.
// The same code runs in the Expo web export (there React Native's Animated runs
// in JavaScript, which is fine for a face this small).
//
// Two kinds of motion:
//  - Pose: each mood is a set of numbers (debo-face-poses.ts) the layers ease toward.
//  - Life: breathing, blinking, leaf sway and the odd glance run all the time, and
//    each mood adds its own small loop (a bounce, a wobble, a tremble, steam...).
//
// Moods come from the shared store (debo-mood-store.ts), so every face agrees.
// With "reduce motion" on, the face stays still and only cross-fades between poses.
// The face is decoration next to text that already says the state, so screen
// readers skip it unless a `label` is given.
import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, AppState, Easing, Platform, Pressable, View } from "react-native";
import Svg, { Circle, Ellipse, G, Path } from "react-native-svg";
import { deboPaint as c } from "./debo-face-colors";
import { basePose, type Pose, poses, stillPose } from "./debo-face-poses";
import type { Mood } from "./debo-mood";
import { deboLevels, deboMood, useDeboMood } from "./debo-mood-store";

const native = Platform.OS !== "web";
/** Channels that change what is drawn (not where). They cross-fade instead of travelling. */
const fades = new Set<string>([
  "browOn", "browAngle", "smile", "open", "flat", "frown", "wave", "eyeHappy", "puff", "blush",
  "sweat", "steam", "dots", "spark",
]);
type PoseKey = keyof Pose;
const poseKeys = Object.keys(basePose) as PoseKey[];

/** Anything Animated can compute with. */
type Node = Animated.Value | Animated.AnimatedInterpolation<number>;

function createValues() {
  const pose = {} as Record<PoseKey, Animated.Value>;
  for (const key of poseKeys) pose[key] = new Animated.Value(basePose[key]);
  const v = (n = 0) => new Animated.Value(n);
  return {
    pose,
    breath: v(), sway: v(), blink: v(1), glX: v(), glY: v(), wobble: v(), hop: v(), trem: v(),
    speak: v(), flick: v(), dotsP: v(), steamP: v(), sweatP: v(), huffP: v(), sparkP: v(),
    yawn: v(), squish: v(),
  };
}
type Values = ReturnType<typeof createValues>;

const scale = (n: Node, by: number): Animated.AnimatedInterpolation<number> =>
  n.interpolate({ inputRange: [0, 1], outputRange: [0, by] });
const clamp = (n: Node): Animated.AnimatedInterpolation<number> =>
  n.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: "clamp" });
const deg = (n: Node): Animated.AnimatedInterpolation<number> =>
  n.interpolate({ inputRange: [-180, 180], outputRange: ["-180deg", "180deg"] as unknown as number[] });
const inv = (n: Node): Animated.AnimatedInterpolation<number> =>
  n.interpolate({ inputRange: [0, 1], outputRange: [1, 0], extrapolate: "clamp" });

/** All the moving parts, derived once per size so rendering only reads them. */
function buildNodes(v: Values, S: number) {
  const p = v.pose;
  const bodyScaleX = Animated.multiply(p.sx, Animated.subtract(1, scale(v.breath, 0.01)));
  const bodyScaleY = Animated.multiply(p.sy, Animated.add(1, scale(v.breath, 0.022)));
  const squishX = Animated.add(1, scale(v.squish, 0.13));
  const squishY = Animated.subtract(1, scale(v.squish, 0.15));
  const drive = Animated.add(
    Animated.multiply(v.speak, inv(deboLevels.real)),
    Animated.multiply(deboLevels.debo, deboLevels.real),
  );
  return {
    bodyX: scale(v.trem, 1.6 * S),
    bodyY: Animated.add(
      Animated.add(scale(p.bodyY, S), scale(v.breath, -2.4 * S)),
      scale(v.hop, -8 * S),
    ),
    bodyRot: deg(Animated.add(p.tilt, scale(v.wobble, 3.5))),
    bodySX: Animated.multiply(bodyScaleX, squishX),
    bodySY: Animated.multiply(bodyScaleY, squishY),
    leafLRot: deg(
      Animated.add(Animated.add(scale(p.leafL, -1), scale(v.sway, 3)), scale(v.flick, 12)),
    ),
    leafRRot: deg(
      Animated.add(Animated.add(scale(p.leafR, 1), scale(v.sway, 2.4)), scale(v.flick, -12)),
    ),
    eyeX: scale(Animated.add(p.gazeX, v.glX), S),
    eyeY: scale(Animated.add(p.gazeY, v.glY), S),
    eyeScaleY: Animated.multiply(Animated.multiply(p.eyeOpen, v.blink), p.eyeWide),
    eyeOpenOpacity: inv(p.eyeHappy),
    browLRot: deg(p.browAngle),
    browRRot: deg(scale(p.browAngle, -1)),
    browY: scale(p.browLift, S),
    openOpacity: clamp(Animated.add(p.open, v.yawn)),
    flatOpacity: Animated.multiply(p.flat, inv(v.yawn)),
    openScaleY: Animated.add(
      Animated.add(p.mouthOpen, Animated.multiply(p.talk, drive)),
      scale(v.yawn, 0.9),
    ),
    puffScale: p.puff.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
    dot1: v.dotsP.interpolate({ inputRange: [0, 0.2, 0.4, 1], outputRange: [0.2, 1, 0.2, 0.2] }),
    dot2: v.dotsP.interpolate({ inputRange: [0, 0.3, 0.5, 0.7, 1], outputRange: [0.2, 0.2, 1, 0.2, 0.2] }),
    dot3: v.dotsP.interpolate({ inputRange: [0, 0.5, 0.7, 0.9, 1], outputRange: [0.2, 0.2, 1, 0.2, 0.2] }),
    steamOpacity: Animated.multiply(p.steam, inv(v.steamP)),
    steamY: scale(v.steamP, -14 * S),
    steamScale: v.steamP.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.4] }),
    huffOpacity: Animated.multiply(p.frown, inv(v.huffP)),
    huffX: scale(v.huffP, 16 * S),
    sweatY: scale(v.sweatP, 9 * S),
    sweatOpacity: Animated.multiply(p.sweat, inv(v.sweatP)),
    sparkOpacity: Animated.multiply(p.spark, v.sparkP),
    sparkScale: v.sparkP.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.15] }),
  };
}

// ---- small helpers for motion -------------------------------------------------

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
export { useReducedMotion };

/** False while the app or browser tab is hidden, so nothing animates for nobody. */
function useVisible() {
  const [visible, setVisible] = useState(AppState.currentState !== "background");
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => setVisible(state === "active"));
    const doc = Platform.OS === "web" ? globalThis.document : undefined;
    const onVisibility = () => setVisible(doc?.visibilityState !== "hidden");
    doc?.addEventListener("visibilitychange", onVisibility);
    return () => {
      sub.remove();
      doc?.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  return visible;
}

const t = (value: Animated.Value, toValue: number, duration: number, easing = Easing.inOut(Easing.sin)) =>
  Animated.timing(value, { toValue, duration, easing, useNativeDriver: native });

/** A repeating run of [target, ms] steps. */
function cycle(value: Animated.Value, steps: [number, number][], easing?: (n: number) => number) {
  return Animated.loop(Animated.sequence(steps.map(([to, ms]) => t(value, to, ms, easing))));
}

// ---- the drawing ----------------------------------------------------------------

function Art({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 240 240">
      {children}
    </Svg>
  );
}

/** One full-size layer that holds a single piece of the drawing. */
function Layer({ size, style, children }: { size: number; style?: object; children: React.ReactNode }) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", left: 0, top: 0, width: size, height: size }, style]}
    >
      <Art size={size}>{children}</Art>
    </Animated.View>
  );
}

const origin = (x: number, y: number, S: number) => `${x * S}px ${y * S}px`;

export interface DeboFaceProps {
  size?: number;
  /** Show this mood instead of the shared one (gallery, previews). */
  mood?: Mood;
  /** Tapping gives a small reaction. */
  interactive?: boolean;
  /** Read by screen readers as an image. Leave off when text already says the state. */
  label?: string;
  /** Hold still even if reduce motion is off. */
  still?: boolean;
}

export function DeboFace({ size = 120, mood: forced, interactive, label, still }: DeboFaceProps) {
  const shared = useDeboMood();
  const mood: Mood = forced ?? shared.mood;
  const reduceSetting = useReducedMotion();
  const visible = useVisible();
  const reduce = reduceSetting || !!still;
  const alive = visible && !reduce;
  const S = size / 240;
  const [v] = useState(createValues);
  const n = useMemo(() => buildNodes(v, S), [v, S]);

  // Pose: ease every channel toward the mood's numbers.
  useEffect(() => {
    const target = reduce ? stillPose(poses[mood]) : poses[mood];
    const easing = reduce || mood === "sleepy" ? Easing.out(Easing.quad) : Easing.out(Easing.back(1.2));
    const run = Animated.parallel(
      poseKeys.map((key) => {
        const crossFade = fades.has(key);
        return Animated.timing(v.pose[key], {
          toValue: target[key],
          duration: reduce ? 260 : crossFade ? 240 : 380,
          easing: crossFade ? Easing.inOut(Easing.quad) : easing,
          useNativeDriver: native,
        });
      }),
    );
    run.start();
    return () => run.stop();
  }, [mood, reduce, v]);

  // Life that never stops: breathing and leaf sway.
  useEffect(() => {
    if (!alive) return;
    const slow = mood === "sleepy";
    const breath = cycle(v.breath, [[1, slow ? 2300 : 1500], [0, slow ? 2300 : 1500]]);
    const sway = cycle(v.sway, [[1, 2600], [-1, 2600], [0, 1800]]);
    breath.start();
    sway.start();
    return () => {
      breath.stop();
      sway.stop();
    };
  }, [alive, mood === "sleepy", v]);

  // Blinking at natural, random moments, sometimes twice.
  useEffect(() => {
    if (!alive) return;
    let timer: ReturnType<typeof setTimeout>;
    const blink = (times: number) => {
      Animated.sequence([t(v.blink, 0.06, 70), t(v.blink, 1, 110)]).start(() => {
        if (times > 1) setTimeout(() => blink(times - 1), 120);
      });
    };
    const schedule = () => {
      timer = setTimeout(() => {
        blink(Math.random() < 0.18 ? 2 : 1);
        schedule();
      }, 2200 + Math.random() * 3800);
    };
    schedule();
    return () => {
      clearTimeout(timer);
      v.blink.setValue(1);
    };
  }, [alive, v]);

  // An occasional glance, when she has nothing particular on her mind.
  useEffect(() => {
    const free = mood === "idle" || mood === "listening" || mood === "sleepy";
    if (!alive || !free || mood === "sleepy") return;
    let timer: ReturnType<typeof setTimeout>;
    const glance = () => {
      timer = setTimeout(() => {
        const x = (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 4);
        const y = -1 + Math.random() * 3;
        Animated.sequence([
          Animated.parallel([t(v.glX, x, 260), t(v.glY, y, 260)]),
          Animated.delay(700 + Math.random() * 600),
          Animated.parallel([t(v.glX, 0, 320), t(v.glY, 0, 320)]),
        ]).start();
        glance();
      }, 3000 + Math.random() * 4500);
    };
    glance();
    return () => {
      clearTimeout(timer);
      Animated.parallel([t(v.glX, 0, 200), t(v.glY, 0, 200)]).start();
    };
  }, [alive, mood, v]);

  // Each mood's own small loop.
  useEffect(() => {
    if (!alive) return;
    const running: Animated.CompositeAnimation[] = [];
    const used: Animated.Value[] = [];
    const go = (value: Animated.Value, animation: Animated.CompositeAnimation) => {
      used.push(value);
      running.push(animation);
      animation.start();
    };
    switch (mood) {
      case "thinking":
        go(v.wobble, cycle(v.wobble, [[1, 1500], [-1, 3000], [0, 1500]]));
        go(v.dotsP, Animated.loop(Animated.sequence([t(v.dotsP, 1, 1400, Easing.linear), t(v.dotsP, 0, 1, Easing.linear)])));
        break;
      case "speaking":
        go(v.speak, cycle(v.speak, [[0.9, 140], [0.25, 120], [1, 160], [0.4, 120], [0.75, 150], [0.1, 130]]));
        break;
      case "happy":
        go(v.hop, Animated.sequence([t(v.hop, 1, 190, Easing.out(Easing.quad)), t(v.hop, 0, 230, Easing.in(Easing.quad)), t(v.hop, 0.7, 170, Easing.out(Easing.quad)), t(v.hop, 0, 210, Easing.in(Easing.quad))]));
        go(v.wobble, Animated.sequence([t(v.wobble, 1, 160), t(v.wobble, -1, 280), t(v.wobble, 0.6, 240), t(v.wobble, 0, 200)]));
        break;
      case "proud":
        go(v.sparkP, cycle(v.sparkP, [[1, 700], [0.15, 700]]));
        go(v.hop, Animated.sequence([t(v.hop, 0.5, 260, Easing.out(Easing.quad)), t(v.hop, 0, 360, Easing.in(Easing.quad))]));
        break;
      case "shy":
        go(v.wobble, cycle(v.wobble, [[0.6, 900], [-0.6, 1800], [0, 900]]));
        break;
      case "sleepy":
        go(v.yawn, Animated.loop(Animated.sequence([Animated.delay(5500), t(v.yawn, 1, 1300), Animated.delay(700), t(v.yawn, 0, 1100)])));
        break;
      case "worried":
        go(v.sweatP, Animated.loop(Animated.sequence([t(v.sweatP, 1, 1500, Easing.in(Easing.quad)), t(v.sweatP, 0, 1)])));
        go(v.wobble, cycle(v.wobble, [[0.5, 700], [-0.5, 1400], [0, 700]]));
        break;
      case "pouty":
        // Looks away, then sneaks a sideways glance back. A tiny huff. Leaves droop, then flick.
        go(v.glX, Animated.loop(Animated.sequence([Animated.delay(900), t(v.glX, 17, 260), Animated.delay(450), t(v.glX, 0, 300)])));
        go(v.huffP, Animated.loop(Animated.sequence([Animated.delay(600), t(v.huffP, 1, 700, Easing.out(Easing.quad)), t(v.huffP, 0, 1), Animated.delay(900)])));
        go(v.flick, Animated.loop(Animated.sequence([Animated.delay(1100), t(v.flick, -1, 120), t(v.flick, 1, 160), t(v.flick, 0, 220), Animated.delay(600)])));
        go(v.wobble, cycle(v.wobble, [[0.5, 1100], [-0.2, 1100]]));
        break;
      case "angry":
        go(v.trem, cycle(v.trem, [[1, 170], [-1, 170]], Easing.linear));
        go(v.steamP, Animated.loop(Animated.sequence([t(v.steamP, 1, 1000, Easing.out(Easing.quad)), t(v.steamP, 0, 1)])));
        break;
      default:
        break;
    }
    return () => {
      for (const animation of running) animation.stop();
      Animated.parallel(used.map((value) => t(value, 0, 220))).start();
    };
  }, [alive, mood, v]);

  const squish = () => {
    if (!alive) return;
    Animated.sequence([t(v.squish, 1, 80), Animated.spring(v.squish, { toValue: 0, friction: 3, tension: 220, useNativeDriver: native })]).start();
    Animated.sequence([t(v.blink, 0.06, 70), t(v.blink, 1, 110)]).start();
  };

  const body = (
    <View
      style={{ width: size, height: size }}
      {...(label
        ? { accessible: true, accessibilityRole: "image" as const, accessibilityLabel: label }
        : {
            accessibilityElementsHidden: true,
            importantForAccessibility: "no-hide-descendants" as const,
            ...(Platform.OS === "web" ? { "aria-hidden": true } : {}),
          })}
    >
      <Layer size={size}>
        <Ellipse cx={120} cy={226} rx={70} ry={8} fill={c.shadow} opacity={0.14} />
      </Layer>
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: size,
          height: size,
          transformOrigin: origin(120, 226, S),
          transform: [
            { translateX: n.bodyX },
            { translateY: n.bodyY },
            { rotate: n.bodyRot },
            { scaleX: n.bodySX },
            { scaleY: n.bodySY },
          ],
        }}
      >
        <Layer size={size} style={{ opacity: v.pose.puff, transform: [{ scale: n.puffScale }], transformOrigin: origin(120, 150, S) }}>
          <Ellipse cx={26} cy={150} rx={22} ry={24} fill={c.body} />
          <Ellipse cx={214} cy={150} rx={22} ry={24} fill={c.body} />
          <Ellipse cx={22} cy={160} rx={14} ry={14} fill={c.bodyShade} opacity={0.35} />
          <Ellipse cx={218} cy={160} rx={14} ry={14} fill={c.bodyShade} opacity={0.5} />
        </Layer>
        <Layer size={size}>
          <Path d="M120 66C150 52 204 60 221 118C234 174 190 218 120 218C50 218 6 174 19 118C36 60 90 52 120 66Z" fill={c.body} />
          <Path d="M221 118C234 174 190 218 120 218C62 218 22 188 17 142C40 190 100 200 150 186C196 172 214 150 221 118Z" fill={c.bodyShade} />
          <Ellipse cx={56} cy={112} rx={17} ry={8} fill={c.highlight} opacity={0.4} transform="rotate(-48 56 112)" />
          <Circle cx={45} cy={134} r={4.5} fill={c.highlight} opacity={0.4} />
        </Layer>

        {/* Leaves, left and right, hinged at the stem so they can sway, lift and droop. */}
        <Layer size={size} style={{ transform: [{ rotate: n.leafLRot }], transformOrigin: origin(120, 66, S) }}>
          <G fill={c.leaf}>
            <Path d="M120 66C108 58 84 56 64 70C86 76 106 76 120 66Z" />
            <Path d="M120 66C102 66 82 78 76 96C98 94 114 84 120 66Z" />
          </G>
        </Layer>
        <Layer size={size} style={{ transform: [{ rotate: n.leafRRot }], transformOrigin: origin(120, 66, S) }}>
          <G fill={c.leaf}>
            <Path d="M120 66C132 58 156 56 176 70C154 76 134 76 120 66Z" />
            <Path d="M120 66C138 66 158 78 164 96C142 94 126 84 120 66Z" />
          </G>
        </Layer>
        <Layer size={size}>
          <Path d="M120 70C112 82 114 96 120 104C126 96 128 82 120 70Z" fill={c.leafDark} />
          <Path d="M120 70C119 56 122 46 130 38" fill="none" stroke={c.leafDark} strokeWidth={9} strokeLinecap="round" />
        </Layer>

        <Layer size={size} style={{ opacity: v.pose.blush, transform: [{ scale: v.pose.blushScale }], transformOrigin: origin(120, 158, S) }}>
          <Ellipse cx={60} cy={158} rx={16} ry={10} fill={c.blush} opacity={0.85} />
          <Ellipse cx={180} cy={158} rx={16} ry={10} fill={c.blush} opacity={0.85} />
        </Layer>

        {/* Eyes: open ones blink and look around; closed happy arcs cross-fade in. */}
        <Layer
          size={size}
          style={{
            opacity: n.eyeOpenOpacity,
            transformOrigin: origin(120, 136, S),
            transform: [{ translateX: n.eyeX }, { translateY: n.eyeY }, { scaleX: v.pose.eyeWide }, { scaleY: n.eyeScaleY }],
          }}
        >
          <Ellipse cx={88} cy={136} rx={13} ry={16} fill={c.ink} />
          <Circle cx={93} cy={130} r={5} fill={c.highlight} />
          <Circle cx={84} cy={142} r={2.2} fill={c.highlight} />
          <Ellipse cx={152} cy={136} rx={13} ry={16} fill={c.ink} />
          <Circle cx={157} cy={130} r={5} fill={c.highlight} />
          <Circle cx={148} cy={142} r={2.2} fill={c.highlight} />
        </Layer>
        <Layer size={size} style={{ opacity: v.pose.eyeHappy }}>
          <Path d="M75 142Q88 122 101 142" fill="none" stroke={c.ink} strokeWidth={6} strokeLinecap="round" />
          <Path d="M139 142Q152 122 165 142" fill="none" stroke={c.ink} strokeWidth={6} strokeLinecap="round" />
        </Layer>

        {/* Brows only show when a mood needs them. */}
        <Layer size={size} style={{ opacity: v.pose.browOn, transform: [{ translateY: n.browY }, { rotate: n.browLRot }], transformOrigin: origin(88, 112, S) }}>
          <Path d="M74 112H102" stroke={c.ink} strokeWidth={5} strokeLinecap="round" />
        </Layer>
        <Layer size={size} style={{ opacity: v.pose.browOn, transform: [{ translateY: n.browY }, { rotate: n.browRRot }], transformOrigin: origin(152, 112, S) }}>
          <Path d="M138 112H166" stroke={c.ink} strokeWidth={5} strokeLinecap="round" />
        </Layer>

        {/* Mouths cross-fade. The open one is squashed by Debo's voice level. */}
        <Layer size={size} style={{ opacity: v.pose.smile }}>
          <Path d="M106 158Q120 174 134 158" fill="none" stroke={c.ink} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        </Layer>
        <Layer size={size} style={{ opacity: n.flatOpacity }}>
          <Path d="M110 163H130" fill="none" stroke={c.ink} strokeWidth={5} strokeLinecap="round" />
        </Layer>
        <Layer size={size} style={{ opacity: v.pose.frown }}>
          <Path d="M108 168Q120 157 132 168" fill="none" stroke={c.ink} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        </Layer>
        <Layer size={size} style={{ opacity: v.pose.wave }}>
          <Path d="M106 165Q113 158 120 165T134 165" fill="none" stroke={c.ink} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        </Layer>
        <Layer
          size={size}
          style={{
            opacity: n.openOpacity,
            transformOrigin: origin(120, 152, S),
            transform: [{ scaleX: v.pose.mouthW }, { scaleY: n.openScaleY }],
          }}
        >
          <Ellipse cx={120} cy={164} rx={12} ry={12} fill={c.mouthInside} />
          <Ellipse cx={120} cy={171} rx={7} ry={4.5} fill={c.tongue} />
        </Layer>

        {/* Extras: thinking dots, sweat, steam, huff, sparkles. */}
        {([n.dot1, n.dot2, n.dot3] as const).map((opacity, i) => (
          <Layer key={i} size={size} style={{ opacity: Animated.multiply(v.pose.dots, opacity) }}>
            <Circle cx={172 + i * 16} cy={40 - i * 8} r={5 + i} fill={c.ink} />
          </Layer>
        ))}
        <Layer size={size} style={{ opacity: n.sweatOpacity, transform: [{ translateY: n.sweatY }] }}>
          <Path d="M194 86C187 97 185 104 194 111C203 104 201 97 194 86Z" fill={c.sweat} />
        </Layer>
        <Layer size={size} style={{ opacity: n.steamOpacity, transform: [{ translateY: n.steamY }, { scale: n.steamScale }], transformOrigin: origin(120, 56, S) }}>
          <Circle cx={44} cy={58} r={8} fill={c.steam} />
          <Circle cx={196} cy={58} r={8} fill={c.steam} />
          <Circle cx={30} cy={74} r={5} fill={c.steam} />
          <Circle cx={210} cy={74} r={5} fill={c.steam} />
        </Layer>
        <Layer size={size} style={{ opacity: n.huffOpacity, transform: [{ translateX: n.huffX }] }}>
          <Circle cx={158} cy={168} r={4} fill={c.steam} />
          <Circle cx={166} cy={172} r={3} fill={c.steam} />
        </Layer>
        <Layer size={size} style={{ opacity: n.sparkOpacity, transform: [{ scale: n.sparkScale }], transformOrigin: origin(120, 80, S) }}>
          <Path d="M30 52L33 60L41 63L33 66L30 74L27 66L19 63L27 60Z" fill={c.spark} />
          <Path d="M208 40L210 46L216 48L210 50L208 56L206 50L200 48L206 46Z" fill={c.spark} />
          <Path d="M216 96L218 101L223 103L218 105L216 110L214 105L209 103L214 101Z" fill={c.spark} />
        </Layer>
      </Animated.View>
    </View>
  );

  if (!interactive) return body;
  return (
    <Pressable
      accessible={false}
      focusable={false}
      onPress={() => {
        squish();
        deboMood.tap();
      }}
      style={Platform.OS === "web" ? ({ cursor: "pointer" } as object) : undefined}
    >
      {body}
    </Pressable>
  );
}
