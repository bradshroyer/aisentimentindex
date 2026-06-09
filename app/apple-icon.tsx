import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Same sparkle as app/icon.tsx; iOS applies its own corner mask, so the
// background stays a full square here.
const SPARKLE =
  "M16 3 C17.5 10, 22 14.5, 29 16 C22 17.5, 17.5 22, 16 29 C14.5 22, 10 17.5, 3 16 C10 14.5, 14.5 10, 16 3 Z";

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
          background: "#0C0A09",
        }}
      >
        <svg width="116" height="116" viewBox="0 0 32 32">
          <path d={SPARKLE} fill="#F59E0B" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
