// Turns raw microphone or speaker samples into a calm 0..1 number for the face and halo.
// Pure maths, so it is unit tested and works the same on every platform.

/** Root-mean-square loudness of samples in -1..1 (or 0..255 bytes centred on 128) as 0..1. */
export function rmsLevel(samples: ArrayLike<number>, bytes = false): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = bytes ? (samples[i] - 128) / 128 : samples[i];
    sum += v * v;
  }
  return clamp01(Math.sqrt(sum / samples.length) * 2.4); // speech sits low, so lift it
}

export function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/**
 * Fast to rise, slow to fall, so a mouth or halo follows speech without flicker.
 * `dt` is the time since the last reading in milliseconds.
 */
export function smoothLevel(previous: number, raw: number, dt: number, attackMs = 60, releaseMs = 220): number {
  const target = clamp01(raw);
  const tau = target > previous ? attackMs : releaseMs;
  const k = 1 - Math.exp(-Math.max(0, dt) / tau);
  return clamp01(previous + (target - previous) * k);
}
