import { colorsLight } from "./astryx-tokens";

const c = colorsLight;

/**
 * The app palette. Every value comes from the Astryx Neutral theme tokens, so
 * nothing here is a hand-picked colour. Names are kept short because screens
 * use them everywhere; each line says which Astryx token it is.
 */
export const colors = {
  canvas: c.backgroundBody, // page background (light grey)
  card: c.backgroundSurface, // surfaces that hold content
  subtle: c.backgroundMuted, // quiet fills: secondary buttons, wells, code
  text: c.textPrimary,
  muted: c.textSecondary,
  disabled: c.textDisabled,
  line: c.border,
  lineStrong: c.borderEmphasized, // decorative dividers
  inputBorder: c.textSecondary, // field edges: needs 3:1 against the page
  accent: c.accent, // primary action fill
  onAccent: c.onAccent, // text and icons on the accent fill
  blue: c.backgroundBlue, // soft blue tint
  blueDark: c.textAccent, // links, icons and emphasis in the accent blue
  blueLine: c.borderBlue,
  blueText: c.textBlue, // text on the soft blue tint
  sky: c.backgroundBlue,
  green: c.backgroundGreen,
  success: c.onSuccessMuted, // text and icons for "done" and "on" (dark enough on the soft green)
  successLine: c.borderGreen,
  lavender: c.backgroundPurple,
  orange: c.backgroundOrange,
  yellow: c.backgroundYellow,
  pink: c.backgroundPink,
  danger: c.onErrorMuted, // text for errors and risky actions (dark enough on the soft red)
  dangerBg: c.backgroundRed,
  ink: c.accent, // dark surfaces (toast, previews): the neutral theme accent is near-black
  onInk: c.onDark, // text on dark surfaces
  scrim: c.overlay, // dim layer behind a sheet
  shadow: c.shadow,
};

