import { ImageResponse } from "next/og";
import { getVideoForRank } from "@/lib/getVideoForRank";

export const runtime = "edge";

const RANK_LABELS: Record<string, string> = {
  "1": "Guld",
  "2": "Silver",
  "3": "Brons",
};
const RANK_COLORS: Record<string, string> = {
  "1": "#FCC417",
  "2": "#8A9299",
  "3": "#96614A",
};
const RANK_MEDALS: Record<string, string> = {
  "1": "🥇",
  "2": "🥈",
  "3": "🥉",
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const week = searchParams.get("week") ?? "";
  const rank = parseInt(searchParams.get("rank") ?? "0");

  // Try to load fonts — fall back to sans-serif if anything fails
  let fonts: { name: string; data: ArrayBuffer; weight: 500 | 700; style: "normal" }[] = [];
  let fontFamily = "sans-serif";
  try {
    const [f500, f700] = await Promise.all([
      fetch(new URL("./barlow-condensed-500.woff", import.meta.url)).then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.arrayBuffer();
      }),
      fetch(new URL("./barlow-condensed-700.woff", import.meta.url)).then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.arrayBuffer();
      }),
    ]);
    fonts = [
      { name: "Barlow Condensed", data: f500, weight: 500, style: "normal" },
      { name: "Barlow Condensed", data: f700, weight: 700, style: "normal" },
    ];
    fontFamily = "Barlow Condensed";
  } catch {
    // render with default font rather than crashing
  }

  const video = await getVideoForRank(week, rank);
  const acct = Array.isArray(video?.accounts) ? video?.accounts[0] : video?.accounts;
  const accountName = acct?.display_name ?? (video ? `@${video.handle}` : "Sociala Raketer");
  const er = video?.engagement_rate != null
    ? Number(video.engagement_rate).toFixed(2).replace(".", ",") + "%"
    : "–";
  const weekNum = week ? parseInt(week.split("-W")[1]) : 0;
  const rankLabel = RANK_LABELS[String(rank)] ?? `Plats ${rank}`;
  const rankColor = RANK_COLORS[String(rank)] ?? "#ffffff";
  const medal = RANK_MEDALS[String(rank)] ?? "";
  const thumbnailUrl = video?.thumbnail_url ?? null;

  const navy = "#07253A";
  const white = "#ffffff";
  const magenta = "#F52C69";

  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: navy }}>

      {/* Left panel */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: "50%", height: "100%", padding: "64px 56px", gap: "0px" }}>

        {/* Row 1: Account name — Bold 75px */}
        <span style={{ fontFamily, fontSize: 75, fontWeight: 700, color: white, lineHeight: 1.05 }}>
          {accountName}
        </span>

        {/* Row 2: "Guld vecka 12 🥇" — Medium 50px, rank word colored */}
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "48px" }}>
          <span style={{ fontFamily, fontSize: 50, fontWeight: 500, color: rankColor }}>{rankLabel}</span>
          <span style={{ fontFamily, fontSize: 50, fontWeight: 500, color: white }}>vecka {weekNum} {medal}</span>
        </div>

        {/* Row 3: ER number — Bold 120px */}
        <span style={{ fontFamily, fontSize: 120, fontWeight: 700, color: magenta, lineHeight: 1 }}>
          {er}
        </span>

        {/* Row 4: "engagement rate / på TikTok" — Medium 50px, two lines */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontFamily, fontSize: 50, fontWeight: 500, color: white, lineHeight: 1.2 }}>engagement rate</span>
          <span style={{ fontFamily, fontSize: 50, fontWeight: 500, color: white, lineHeight: 1.2 }}>på TikTok</span>
        </div>

      </div>

      {/* Right panel: thumbnail */}
      <div style={{ display: "flex", width: "50%", height: "100%", flexShrink: 0 }}>
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : null}
      </div>

    </div>,
    { width: 1200, height: 630, fonts }
  );
}
