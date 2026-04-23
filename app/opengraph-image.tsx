import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AI Sentiment Index — tracking how major news outlets talk about AI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0C0A09",
          color: "#F5F0EB",
          fontFamily: "Georgia, serif",
        }}
      >
        {/* Accent bar */}
        <div
          style={{
            width: 48,
            height: 4,
            background: "#F59E0B",
            borderRadius: 2,
            marginBottom: 24,
          }}
        />
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          AI Sentiment Index
        </div>
        <div
          style={{
            fontSize: 28,
            color: "#A8A29E",
            marginTop: 24,
            lineHeight: 1.4,
          }}
        >
          How positive or negative are major news outlets when they
          write about AI?
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 40,
            fontSize: 18,
            color: "#57534E",
            fontFamily: "monospace",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          <span>14 sources</span>
          <span style={{ color: "#F59E0B" }}>&middot;</span>
          <span>daily scores</span>
          <span style={{ color: "#F59E0B" }}>&middot;</span>
          <span>&minus;1.0 to +1.0</span>
        </div>
        {/* Domain */}
        <div
          style={{
            position: "absolute",
            bottom: 60,
            right: 80,
            fontSize: 20,
            color: "#57534E",
            fontFamily: "monospace",
          }}
        >
          labs.bradshroyer.com
        </div>
      </div>
    ),
    { ...size }
  );
}
