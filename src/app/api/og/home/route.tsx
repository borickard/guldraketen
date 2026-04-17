import { ImageResponse } from "next/og";
import { getVideoForRank } from "@/lib/getVideoForRank";

export const runtime = "edge";

function toISOWeek(date: Date): string {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const week1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function prevWeek(weekStr: string): string {
  const [yr, wk] = weekStr.split("-W").map(Number);
  const jan4 = new Date(Date.UTC(yr, 0, 4));
  const mon = new Date(jan4);
  mon.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (wk - 1) * 7 - 7);
  return toISOWeek(mon);
}

function getMostRecentPublishedWeek(): string {
  return prevWeek(prevWeek(toISOWeek(new Date())));
}

const RANKS = [
  { label: "Guld",   color: "#C8962A" },
  { label: "Silver", color: "#8A9299" },
  { label: "Brons",  color: "#96614A" },
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const week = searchParams.get("week") ?? getMostRecentPublishedWeek();
  const weekNum = parseInt(week.split("-W")[1]);
  const year = week.split("-W")[0];

  let fonts: { name: string; data: ArrayBuffer; weight: 500 | 700; style: "normal" }[] = [];
  let fontFamily = "sans-serif";
  try {
    const [f500, f700] = await Promise.all([
      fetch(new URL("./barlow-condensed-500.woff", import.meta.url)).then((r) => r.arrayBuffer()),
      fetch(new URL("./barlow-condensed-700.woff", import.meta.url)).then((r) => r.arrayBuffer()),
    ]);
    fonts = [
      { name: "BC", data: f500, weight: 500, style: "normal" },
      { name: "BC", data: f700, weight: 700, style: "normal" },
    ];
    fontFamily = "BC";
  } catch {
    // fallback to sans-serif
  }

  const videos = await Promise.all([
    getVideoForRank(week, 1),
    getVideoForRank(week, 2),
    getVideoForRank(week, 3),
  ]);

  const navy = "#07253A";
  const white = "#EDF8FB";
  const dim = "rgba(237,248,251,0.45)";

  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: navy, padding: "60px" }}>

      {/* Left: brand */}
      <div style={{ display: "flex", flexDirection: "column", width: "340px", flexShrink: 0 }}>
        <span style={{ fontFamily, fontSize: 13, fontWeight: 700, color: "#C8962A", letterSpacing: "0.18em", textTransform: "uppercase" }}>
          Sociala Raketer
        </span>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontFamily, fontSize: 80, fontWeight: 700, color: white, lineHeight: 1, letterSpacing: "-0.01em" }}>Veckans</span>
          <span style={{ fontFamily, fontSize: 80, fontWeight: 700, color: white, lineHeight: 1, letterSpacing: "-0.01em" }}>Raketer</span>
        </div>
        <span style={{ fontFamily, fontSize: 20, fontWeight: 500, color: dim, marginTop: "20px" }}>
          Vecka {weekNum} · {year}
        </span>
      </div>

      {/* Divider */}
      <div style={{ width: "1px", background: "rgba(237,248,251,0.12)", margin: "0 56px", flexShrink: 0 }} />

      {/* Right: rank rows */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
        {videos.map((video, i) => {
          const acct = Array.isArray(video?.accounts) ? video?.accounts[0] : video?.accounts;
          const name = acct?.display_name ?? (video ? `@${video.handle}` : "–");
          const er = video?.engagement_rate != null
            ? Number(video.engagement_rate).toFixed(2).replace(".", ",") + "%"
            : "–";
          const { label, color } = RANKS[i];

          return (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                paddingBottom: i < 2 ? "28px" : "0",
                borderBottom: i < 2 ? "1px solid rgba(237,248,251,0.1)" : "none",
                flex: 1,
                justifyContent: "center",
              }}
            >
              <span style={{ fontFamily, fontSize: 13, fontWeight: 700, color, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "8px" }}>
                {label}
              </span>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <span style={{ fontFamily, fontSize: 36, fontWeight: 700, color: white, flex: 1 }}>{name}</span>
                <span style={{ fontFamily, fontSize: 48, fontWeight: 700, color, marginLeft: "24px", letterSpacing: "-0.01em" }}>{er}</span>
              </div>
            </div>
          );
        })}
      </div>

    </div>,
    { width: 1200, height: 630, fonts }
  );
}
