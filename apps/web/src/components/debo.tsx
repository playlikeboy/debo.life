"use client";

import { useEffect, useRef } from "react";
import { DeboArt } from "./debo-art";

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
        const dy = event.clientY - (box.top + box.height * 0.57);
        const distance = Math.hypot(dx, dy) || 1;
        // Eyes move at most 6 units inside the face, easing in with distance.
        const reach = Math.min(6, distance / 45);
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

  return <DeboArt className={className} svgRef={svgRef} leftEyeRef={leftRef} rightEyeRef={rightRef} />;
}
