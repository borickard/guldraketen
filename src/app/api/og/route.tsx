import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#07253A" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: "50%", height: "100%", padding: "56px", gap: "16px" }}>
        <span style={{ fontSize: 36, color: "white" }}>VECKA 12</span>
        <span style={{ fontSize: 75, color: "rgb(254,44,85)" }}>Testföretag AB</span>
        <span style={{ fontSize: 84, color: "rgb(254,44,85)" }}>3,14%</span>
      </div>
      <div style={{ display: "flex", width: "50%", height: "100%", background: "#0a3a5c" }} />
    </div>,
    { width: 1200, height: 630 }
  );
}
