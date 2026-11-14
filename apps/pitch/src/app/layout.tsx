import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
// No custom CSS in this app: the three Astryx stylesheets, plus the font files below.
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "@astryxdesign/theme-neutral/theme.css";
// Figtree served from our own domain, the same four files as the landing page (apps/site).
import "@fontsource/figtree/latin-400.css";
import "@fontsource/figtree/latin-500.css";
import "@fontsource/figtree/latin-600.css";
import "@fontsource/figtree/latin-700.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  metadataBase: new URL("https://pitch.debo.life"),
  title: { default: "Debo: investor pitch", template: "%s | Debo pitch" },
  description: "The pitch, the numbers and the sources for Debo, a friendly assistant that remembers your life.",
  applicationName: "Debo",
  // For investors, not search: <meta name="robots" content="noindex">.
  robots: "noindex",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f1f1" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1b1b" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
