// The tomato's own paint. These match docs/assets/debo.svg, the master drawing,
// so the code-drawn face and the picture stay the same character. They are the
// only raw colour values outside astryx-tokens.ts, and the hard-coded style test
// allow-lists this one file for that reason: Debo is a character, not UI chrome,
// and the app theme must never recolour her.
export const deboPaint = {
  body: "#e5392b",
  bodyShade: "#c42a20",
  highlight: "#ffffff",
  leaf: "#3f9b45",
  leafDark: "#2f7d33",
  blush: "#ffb0a8",
  ink: "#1b1b1b",
  mouthInside: "#7a1712",
  tongue: "#ff7a6e",
  sweat: "#8ed0ff",
  steam: "#ffc2ba",
  spark: "#ffd23f",
  shadow: "#1b1b1b",
} as const;
