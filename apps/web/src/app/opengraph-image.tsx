import { ImageResponse } from "next/og";
import { DeboArt } from "@/components/debo-art";

// The picture shown when someone shares a link to debo.life.
// Built once at build time; colours match DESIGN.md.
export const dynamic = "force-static";
export const alt = "Debo, a round yellow character, next to the words: a friendly assistant that remembers your life";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#1b1f4b";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 56,
          padding: "0 88px",
          background: "#e9eeff",
          color: INK,
        }}
      >
        <DeboArt width={400} height={400} blink={false} />
        <div style={{ display: "flex", flexDirection: "column", width: 570 }}>
          <div style={{ fontSize: 112, letterSpacing: -3 }}>Debo</div>
          <div style={{ fontSize: 48, lineHeight: 1.2, marginTop: 12 }}>
            A friendly assistant that remembers your life.
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 36,
              fontSize: 30,
              padding: "8px 20px",
              border: `3px solid ${INK}`,
              borderRadius: 12,
              background: "#c4f1da",
              alignSelf: "flex-start",
            }}
          >
            Early version. Still being built.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
