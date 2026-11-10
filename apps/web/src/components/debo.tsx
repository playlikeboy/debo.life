"use client";

import { useEffect, useRef } from "react";

/**
 * Debo, the mascot. Its eyes follow the pointer.
 * Decorative: always aria-hidden. See DESIGN.md before changing it.
 */
export function Debo({ className }: { className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const leftRef = useRef<SVGGElement>(null);
  const rightRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;

    let frame = 0;

    const look = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const svg = svgRef.current;
        if (!svg) return;
        const box = svg.getBoundingClientRect();
        const dx = event.clientX - (box.left + box.width / 2);
        const dy = event.clientY - (box.top + box.height * 0.45);
        const distance = Math.hypot(dx, dy) || 1;
        // Pupils move at most 7 units inside the eye, easing in with distance.
        const reach = Math.min(7, distance / 40);
        const x = (dx / distance) * reach;
        const y = (dy / distance) * reach;
        const move = `translate(${x.toFixed(2)} ${y.toFixed(2)})`;
        leftRef.current?.setAttribute("transform", move);
        rightRef.current?.setAttribute("transform", move);
      });
    };

    window.addEventListener("pointermove", look, { passive: true });
    return () => {
      window.removeEventListener("pointermove", look);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 240 240"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* soft ground shadow */}
      <ellipse cx="120" cy="222" rx="70" ry="9" fill="#1b1f4b" opacity="0.12" />
      {/* body: a slightly squashed round shape */}
      <path
        d="M120 22c58 0 96 40 96 96 0 60-36 98-96 98s-96-38-96-98c0-56 38-96 96-96z"
        fill="#ffd23f"
        stroke="#1b1f4b"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      {/* little tuft */}
      <path
        d="M112 24c-2-10 2-17 9-20M126 23c2-7 7-11 13-12"
        fill="none"
        stroke="#1b1f4b"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* cheeks */}
      <ellipse cx="62" cy="140" rx="15" ry="10" fill="#ffb3c7" />
      <ellipse cx="178" cy="140" rx="15" ry="10" fill="#ffb3c7" />
      {/* eyes */}
      <g className="debo-eye">
        <ellipse cx="88" cy="108" rx="19" ry="23" fill="#ffffff" stroke="#1b1f4b" strokeWidth="4" />
        <g ref={leftRef}>
          <circle cx="88" cy="110" r="10" fill="#1b1f4b" />
          <circle cx="92" cy="105" r="3.2" fill="#ffffff" />
        </g>
      </g>
      <g className="debo-eye">
        <ellipse cx="152" cy="108" rx="19" ry="23" fill="#ffffff" stroke="#1b1f4b" strokeWidth="4" />
        <g ref={rightRef}>
          <circle cx="152" cy="110" r="10" fill="#1b1f4b" />
          <circle cx="156" cy="105" r="3.2" fill="#ffffff" />
        </g>
      </g>
      {/* smile */}
      <path
        d="M102 150c8 11 28 11 36 0"
        fill="none"
        stroke="#1b1f4b"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}
