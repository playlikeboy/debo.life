import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
// The only stylesheets in this app: the three Astryx imports. No custom CSS.
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "@astryxdesign/theme-neutral/theme.css";
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
