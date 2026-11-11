import { ImageResponse } from "next/og";
import { DeboArt } from "@/components/debo-art";

// The icon an iPhone or iPad shows when Debo is added to the home screen.
// iOS wants a square PNG with no see-through parts, so Debo sits on sky blue.
// Built once at build time.
export const dynamic = "force-static";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#e9eeff",
        }}
      >
        <DeboArt width={132} height={132} ground={false} blink={false} />
      </div>
    ),
    size,
  );
}
