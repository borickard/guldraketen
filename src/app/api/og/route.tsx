import { ImageResponse } from "next/og";
import { barlowCondensed600, barlowCondensed800 } from "./fonts";

export const runtime = "edge";

function b64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

export async function GET() {
  const fonts = [
    { name: "Barlow Condensed", data: b64ToArrayBuffer(barlowCondensed600), weight: 600 as const, style: "normal" as const },
    { name: "Barlow Condensed", data: b64ToArrayBuffer(barlowCondensed800), weight: 800 as const, style: "normal" as const },
  ];

  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#07253A" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: "50%", height: "100%", padding: "56px", gap: "16px" }}>
        <span style={{ fontFamily: "Barlow Condensed", fontSize: 36, fontWeight: 600, color: "white" }}>VECKA 12</span>
        <span style={{ fontFamily: "Barlow Condensed", fontSize: 75, fontWeight: 800, color: "rgb(254,44,85)" }}>Testföretag AB</span>
        <span style={{ fontFamily: "Barlow Condensed", fontSize: 42, fontWeight: 600, color: "white" }}>Silverraket</span>
        <span style={{ fontFamily: "Barlow Condensed", fontSize: 84, fontWeight: 800, color: "rgb(254,44,85)" }}>3,14%</span>
        <span style={{ fontFamily: "Barlow Condensed", fontSize: 36, fontWeight: 600, color: "white" }}>engagement rate</span>
      </div>
      <div style={{ display: "flex", width: "50%", height: "100%", background: "#0a3a5c" }} />
    </div>,
    { width: 1200, height: 630, fonts }
  );
}
