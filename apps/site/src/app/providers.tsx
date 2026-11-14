"use client";

import type { ReactNode } from "react";
import { Theme } from "@astryxdesign/core/theme";
import { butterTheme } from "@astryxdesign/theme-butter/built";

// Brand comes from Astryx's butter theme. mode="system" follows the
// person's light or dark setting.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <Theme theme={butterTheme} mode="system">
      {children}
    </Theme>
  );
}
