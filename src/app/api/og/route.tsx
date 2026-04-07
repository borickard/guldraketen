import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#07253A", color: "white", fontSize: 72, justifyContent: "center", alignItems: "center" }}>
      OG works
    </div>,
    { width: 1200, height: 630 }
  );
}
