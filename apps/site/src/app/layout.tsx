import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
// No custom CSS in this app: the three Astryx stylesheets, plus the font files below.
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "@astryxdesign/theme-neutral/theme.css";
// The theme names the typeface Figtree but never loads it. These four files are
// Figtree served from our own domain (self-hosted through Next), so a visitor's
// browser makes no request to Google. The family name is exactly "Figtree",
// which is what the theme's font tokens already point at.
import "@fontsource/figtree/latin-400.css";
import "@fontsource/figtree/latin-500.css";
import "@fontsource/figtree/latin-600.css";
import "@fontsource/figtree/latin-700.css";
import { Providers } from "./providers";

const TITLE = "Debo: a friendly assistant that remembers your life";
const DESCRIPTION =
  "Write things down or say them out loud. Ask Debo about your own life and see the source of every answer. You can see, fix, download and delete everything.";

export const metadata: Metadata = {
  metadataBase: new URL("https://about.debo.life"),
  title: { default: TITLE, template: "%s | Debo" },
  description: DESCRIPTION,
  applicationName: "Debo",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Debo",
    url: "/",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Debo, a small red tomato, and the words: a friendly assistant that remembers your life",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og.png"],
  },
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
