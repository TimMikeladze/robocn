import { ImageResponse } from "next/og"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

/** A typographic card in the cube's own palette. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#131824",
          color: "#e8eef4",
          padding: 72,
          fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 44,
              height: 44,
              background: "#22c55e",
              clipPath: "polygon(50% 0, 100% 25%, 50% 50%, 0 25%)",
            }}
          />
          <div style={{ fontSize: 30, opacity: 0.75 }}>cube.robocn.dev</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -3 }}>
            one move a day
          </div>
          <div style={{ fontSize: 38, opacity: 0.8 }}>
            One Rubik&apos;s cube. Owned by everybody. Archived forever.
          </div>
        </div>
        <div style={{ display: "flex", gap: 36, fontSize: 26, opacity: 0.65 }}>
          <span>U</span>
          <span style={{ color: "#facc15" }}>D</span>
          <span style={{ color: "#f97316" }}>L</span>
          <span style={{ color: "#dc2626" }}>R</span>
          <span style={{ color: "#22c55e" }}>F</span>
          <span style={{ color: "#2563eb" }}>B</span>
        </div>
      </div>
    ),
    size,
  )
}
