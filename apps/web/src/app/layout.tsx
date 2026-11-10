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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
