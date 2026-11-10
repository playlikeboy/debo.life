import type { Ref } from "react";

/**
 * The drawing of Debo, shared by the live mascot, the logo and the share image.
 * Plain SVG with no state, so it also works at build time.
 * Colours come from DESIGN.md. Debo is always decorative: aria-hidden.
 */

const INK = "#1b1f4b";
const BUTTER = "#ffd23f";
const BLUSH = "#ffb3c7";
const WHITE = "#ffffff";

type DeboArtProps = {
  className?: string;
  /** Draw the soft shadow under Debo. Off for small marks. */
  ground?: boolean;
  /** Blink now and then. Only the one live mascot on a screen should blink. */
  blink?: boolean;
  width?: number;
  height?: number;
  svgRef?: Ref<SVGSVGElement>;
  leftEyeRef?: Ref<SVGGElement>;
  rightEyeRef?: Ref<SVGGElement>;
};

export function DeboArt({
  className,
  ground = true,
  blink = true,
  width,
  height,
  svgRef,
  leftEyeRef,
  rightEyeRef,
}: DeboArtProps) {
  return (
    <svg
      ref={svgRef}
      viewBox="0 0 240 240"
      width={width}
      height={height}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {ground && <ellipse cx="120" cy="226" rx="66" ry="8" fill={INK} opacity="0.12" />}

      {/* body: a soft rice-cake shape, a little wider at the bottom */}
      <path
        d="M120 38C180 38 216 86 216 142C216 196 176 218 120 218C64 218 24 196 24 142C24 86 60 38 120 38Z"
        fill={BUTTER}
        stroke={INK}
        strokeWidth="6"
        strokeLinejoin="round"
      />

      {/* one curl of hair */}
      <path
        d="M116 40C108 22 124 10 136 18C144 24 138 35 129 31"
        fill="none"
        stroke={INK}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* flat shine on the body */}
      <ellipse cx="70" cy="92" rx="14" ry="7" fill={WHITE} opacity="0.75" transform="rotate(-35 70 92)" />
      <circle cx="88" cy="74" r="4" fill={WHITE} opacity="0.75" />

      {/* cheeks */}
      <ellipse cx="62" cy="164" rx="17" ry="11" fill={BLUSH} />
      <ellipse cx="178" cy="164" rx="17" ry="11" fill={BLUSH} />

      {/* eyes: big, dark and shiny; each group moves to look at the pointer */}
      <g className={blink ? "debo-eye" : undefined}>
        <g ref={leftEyeRef}>
          <ellipse cx="88" cy="136" rx="16" ry="19" fill={INK} />
          <circle cx="94" cy="128" r="6" fill={WHITE} />
          <circle cx="83" cy="145" r="2.8" fill={WHITE} />
        </g>
      </g>
      <g className={blink ? "debo-eye" : undefined}>
        <g ref={rightEyeRef}>
          <ellipse cx="152" cy="136" rx="16" ry="19" fill={INK} />
          <circle cx="158" cy="128" r="6" fill={WHITE} />
          <circle cx="147" cy="145" r="2.8" fill={WHITE} />
        </g>
      </g>

      {/* small happy mouth */}
      <path
        d="M107 160Q113.5 169 120 160Q126.5 169 133 160"
        fill="none"
        stroke={INK}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
