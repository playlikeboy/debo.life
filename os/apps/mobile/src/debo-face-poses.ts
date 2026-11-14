// What each mood looks like, as numbers. Every number is a pose channel the face
// eases toward, so changing mood is a smooth move, never a jump.
// Distances are in the 240 x 240 drawing space of docs/assets/debo.svg; angles are degrees.
import type { Mood } from "./debo-mood";

export interface Pose {
  bodyY: number; // lean and dip (down is positive)
  tilt: number; // head tilt, clockwise positive
  sx: number; // body squash and stretch
  sy: number;
  gazeX: number; // where the eyes look
  gazeY: number;
  eyeOpen: number; // 0 closed .. 1 open
  eyeWide: number; // 1 normal, bigger = wide eyes
  eyeHappy: number; // 1 = closed happy arcs
  browOn: number;
  browAngle: number; // positive = cross (inner ends down), negative = worried
  browLift: number; // up is negative
  smile: number; // mouth shapes cross-fade, they add up to about 1
  open: number;
  flat: number;
  frown: number;
  wave: number;
  mouthOpen: number; // height of the open mouth 0..1
  mouthW: number; // width of the open mouth
  eyeShut: number; // 1 = eyes closed as two short lines (a deliberate "not looking")
  pout: number; // small pursed mouth
  bodyX: number; // turn away: slide sideways
  talk: number; // 1 = the open mouth follows Debo's voice
  blush: number;
  blushScale: number;
  puff: number; // puffed cheeks
  leafL: number; // leaf angle: negative lifts, positive droops
  leafR: number;
  sweat: number;
  steam: number;
  dots: number; // thinking dots
  spark: number;
}

export const basePose: Pose = {
  bodyY: 0, tilt: 0, sx: 1, sy: 1, gazeX: 0, gazeY: 0, eyeOpen: 1, eyeWide: 1, eyeHappy: 0,
  browOn: 0, browAngle: 0, browLift: 0, smile: 1, open: 0, flat: 0, frown: 0, wave: 0,
  mouthOpen: 0.3, mouthW: 1, eyeShut: 0, pout: 0, bodyX: 0, talk: 0, blush: 0.85, blushScale: 1, puff: 0, leafL: 0, leafR: 0,
  sweat: 0, steam: 0, dots: 0, spark: 0,
};

const p = (changes: Partial<Pose>): Pose => ({ ...basePose, ...changes });

export const poses: Record<Mood, Pose> = {
  idle: p({}),
  listening: p({ sx: 1.05, sy: 1.05, bodyY: 3, eyeWide: 1.16, leafL: -12, leafR: -12, gazeY: -1 }),
  thinking: p({
    gazeX: 9, gazeY: -8, tilt: -5, smile: 0, flat: 1, browOn: 1, browLift: -6, dots: 1, leafL: -4, leafR: -4,
  }),
  speaking: p({ smile: 0.15, open: 1, mouthOpen: 0.2, mouthW: 1, talk: 1 }),
  happy: p({
    eyeHappy: 1, smile: 0, open: 1, mouthOpen: 0.55, mouthW: 1.1, blush: 1, blushScale: 1.25,
    bodyY: -3, leafL: -16, leafR: -16, sx: 0.98, sy: 1.03,
  }),
  proud: p({
    eyeHappy: 1, smile: 1, blush: 1, blushScale: 1.1, bodyY: -4, sy: 1.06, sx: 0.98, tilt: 3,
    leafL: -22, leafR: -22, spark: 1,
  }),
  shy: p({
    gazeX: -9, gazeY: 6, tilt: -8, bodyY: 3, sx: 0.97, eyeOpen: 0.85, blush: 1, blushScale: 1.55,
    leafL: 6, leafR: 6, browOn: 1, browLift: -2, browAngle: -8,
  }),
  curious: p({
    tilt: 10, gazeX: 6, gazeY: -4, eyeWide: 1.1, smile: 0, open: 1, mouthOpen: 0.28, mouthW: 0.5,
    browOn: 1, browLift: -8, leafL: -14, leafR: -4,
  }),
  sleepy: p({
    eyeOpen: 0.22, tilt: 4, bodyY: 5, sy: 0.97, smile: 0, flat: 1, blush: 0.65, leafL: 16, leafR: 16,
    gazeY: 3, mouthOpen: 0.05,
  }),
  worried: p({
    browOn: 1, browAngle: -15, browLift: -5, smile: 0, wave: 1, eyeWide: 1.06, gazeY: 2, sweat: 1,
    leafL: 10, leafR: 10, bodyY: 2, blush: 0.55,
  }),
  // Pretend anger: turned away, chin up, eyes shut, one cheek puffed, a pursed mouth.
  // The face loop adds the sideways peek, the hmph and the leaf flick.
  pouty: p({
    puff: 1, smile: 0, pout: 1, eyeShut: 1, eyeOpen: 0, bodyX: -5, bodyY: -3, tilt: 7, sy: 1.03,
    browOn: 1, browAngle: 7, browLift: 1, blush: 1, blushScale: 1.35, leafL: -2, leafR: -2,
  }),
  angry: p({
    browOn: 1, browAngle: 24, browLift: 3, smile: 0, frown: 1, eyeOpen: 0.82, sx: 1.04, sy: 0.98,
    steam: 1, blush: 1, blushScale: 1.2, leafL: -18, leafR: -18, bodyY: 1,
  }),
};

/** With reduced motion the face holds still. Only looks change, and they cross-fade. */
export function stillPose(pose: Pose): Pose {
  return {
    ...pose,
    bodyY: 0, bodyX: 0, tilt: 0, sx: 1, sy: 1, gazeX: 0, gazeY: 0, eyeWide: 1, browLift: 0, leafL: 0, leafR: 0,
    blushScale: 1, mouthOpen: pose.open > 0.5 ? Math.min(0.5, pose.mouthOpen) : pose.mouthOpen,
  };
}
