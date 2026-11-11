import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/figtree";
import "./globals.css";

const title = "Debo: a friendly assistant that remembers your life";
const description =
  "Give Debo your journals, voice notes, papers and photos. Ask about your own life and get answers that show where they came from. Being built now.";

export const metadata: Metadata = {
  metadataBase: new URL("https://debo.life"),
  title,
  description,
  applicationName: "Debo",
  // Added to an iPhone's home screen, Debo opens full screen with its own name.
  appleWebApp: { title: "Debo", statusBarStyle: "default" },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "https://debo.life",
    siteName: "Debo",
    title,
    description,
  },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = {
  themeColor: "#e9eeff",
  width: "device-width",
  initialScale: 1,
  // On Android, the on-screen keyboard shrinks the page instead of covering
  // it, so the chat's question box stays in sight above the keys.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
