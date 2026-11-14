import type { CSSProperties } from "react";

// Astryx buttons are 32 or 36px tall. Every press target on this page must be
// at least 44px, and Astryx has a token for exactly that: spacing step 11 is
// 2.75rem. This is the only style value outside the component props, and it is
// a token (documented under "className and style props" in the styling docs).
export const TOUCH: CSSProperties = { minHeight: "var(--spacing-11)" };
