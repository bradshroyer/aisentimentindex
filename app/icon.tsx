import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Four-point sparkle — the same ✦ motif as the footer divider. Drawn as a
// path rather than a text glyph so it doesn't depend on satori's bundled
// font coverage.
const SPARKLE =
  "M16 3 C17.5 10, 22 14.5, 29 16 C22 17.5, 17.5 22, 16 29 C14.5 22, 10 17.5, 3 16 C10 14.5, 14.5 10, 16 3 Z";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0C0A09",
          borderRadius: 7,
        }}
      >
        <svg width="26" height="26" viewBox="0 0 32 32">
          <path d={SPARKLE} fill="#F59E0B" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
