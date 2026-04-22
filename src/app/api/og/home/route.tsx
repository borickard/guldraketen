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

// Validate the thumbnail URL is reachable without downloading the full image.
// Passes the original URL directly to Satori (no base64 conversion = no memory spike).
// Returns null if unreachable so we fall back to a dark background instead of crashing.
async function safeThumb(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(1500) });
    return r.ok ? url : null;
  } catch {
    return null;
  }
}

const RANKS = [
  { num: "1", color: "#C8962A" },
  { num: "2", color: "#8A9299" },
  { num: "3", color: "#96614A" },
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const week = searchParams.get("week") ?? getMostRecentPublishedWeek();
  const weekNum = parseInt(week.split("-W")[1]);
  const year = week.split("-W")[0];

  let fonts: { name: string; data: ArrayBuffer; weight: 700; style: "normal" }[] = [];
  let fontFamily = "sans-serif";
  try {
    const f700 = await fetch(new URL("./barlow-condensed-700.woff", import.meta.url)).then((r) => r.arrayBuffer());
    fonts = [{ name: "BC", data: f700, weight: 700, style: "normal" }];
    fontFamily = "BC";
  } catch {
    // fallback to sans-serif
  }

  const videos = await Promise.all([
    getVideoForRank(week, 1),
    getVideoForRank(week, 2),
    getVideoForRank(week, 3),
  ]);

  // Pre-fetch thumbnails as data URLs before passing to Satori
  const thumbs = await Promise.all(videos.map((v) => safeThumb(v?.thumbnail_url ?? null)));

  const navy = "#07253A";

  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: navy }}>
      {RANKS.map(({ num, color }, i) => {
        const video = videos[i];
        const thumb = thumbs[i];
        const er = video?.engagement_rate != null
          ? Number(video.engagement_rate).toFixed(2).replace(".", ",") + "%"
          : "–";

        return (
          <div
            key={num}
            style={{
              position: "relative",
              display: "flex",
              width: "400px",
              height: "630px",
              flexShrink: 0,
              overflow: "hidden",
              background: navy,
            }}
          >
            {thumb && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumb}
                alt=""
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
              />
            )}

            {/* Rank badge — top left */}
            <div
              style={{
                position: "absolute",
                top: 16,
                left: 16,
                background: color,
                borderRadius: 6,
                padding: "4px 10px",
                display: "flex",
              }}
            >
              <span style={{ fontFamily, fontSize: 22, fontWeight: 700, color: "#fff" }}>#{num}</span>
            </div>

            {/* ER badge — bottom right */}
            <div
              style={{
                position: "absolute",
                bottom: 20,
                right: 16,
                background: "#07253A",
                borderRadius: 8,
                padding: "6px 16px",
                display: "flex",
              }}
            >
              <span style={{ fontFamily, fontSize: 36, fontWeight: 700, color }}>{er}</span>
            </div>

            {/* No-thumbnail fallback: show week label on first panel */}
            {!thumb && i === 0 && (
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", width: "100%", height: "100%", gap: "8px" }}>
                <span style={{ fontFamily, fontSize: 14, fontWeight: 700, color: "#C8962A", letterSpacing: "0.14em" }}>SOCIALA RAKETER</span>
                <span style={{ fontFamily, fontSize: 52, fontWeight: 700, color: "#EDF8FB" }}>V{weekNum} {year}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>,
    {
      width: 1200,
      height: 630,
      fonts,
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
