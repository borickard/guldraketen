import { ImageResponse } from "next/og";
import { getVideoForRank } from "@/lib/getVideoForRank";

export const runtime = "edge";

async function loadFont(origin: string, weight: 600 | 800): Promise<ArrayBuffer> {
  const res = await fetch(`${origin}/fonts/barlow-condensed-${weight}.woff2`);
  if (!res.ok) throw new Error(`Font fetch failed: ${res.status}`);
  return res.arrayBuffer();
}

const RANK_LABELS: Record<string, string> = {
  "1": "Guldraket",
  "2": "Silverraket",
  "3": "Bronsraket",
};
const RANK_MEDALS: Record<string, string> = {
  "1": "🥇",
  "2": "🥈",
  "3": "🥉",
};

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const week = searchParams.get("week") ?? "";
  const rank = parseInt(searchParams.get("rank") ?? "0");

  const [video] = await Promise.all([
    getVideoForRank(week, rank),
  ]);

  const acct = Array.isArray(video?.accounts) ? video?.accounts[0] : video?.accounts;
  const accountName = acct?.display_name ?? (video ? `@${video.handle}` : "Sociala Raketer");
  const er = video?.engagement_rate != null
    ? Number(video.engagement_rate).toFixed(2).replace(".", ",") + "%"
    : "–";

  const weekNum = week ? parseInt(week.split("-W")[1]) : 0;
  const rankLabel = RANK_LABELS[String(rank)] ?? `Plats ${rank}`;
  const medal = RANK_MEDALS[String(rank)] ?? "";
  const weekLabel = weekNum ? `Vecka ${weekNum}` : "";
  const thumbnailUrl = video?.thumbnail_url ?? null;

  const navy = "#07253A";
  const white = "#ffffff";
  const magenta = "rgb(254,44,85)";

  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%" }}>

      {/* ── Left panel ── */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        width: "600px",
        height: "630px",
        backgroundColor: navy,
        padding: "56px",
        gap: "14px",
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: "Barlow Condensed", fontSize: "36px", fontWeight: 600, color: white, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {weekLabel}
        </span>
        <span style={{ fontFamily: "Barlow Condensed", fontSize: "75px", fontWeight: 800, color: magenta, lineHeight: 1.0, letterSpacing: "-0.01em" }}>
          {accountName}
        </span>
        <span style={{ fontFamily: "Barlow Condensed", fontSize: "42px", fontWeight: 600, color: white }}>
          {rankLabel} {medal}
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "10px" }}>
          <span style={{ fontFamily: "Barlow Condensed", fontSize: "84px", fontWeight: 800, color: magenta, lineHeight: 1 }}>
            {er}
          </span>
          <span style={{ fontFamily: "Barlow Condensed", fontSize: "36px", fontWeight: 600, color: white, letterSpacing: "0.08em" }}>
            engagement rate
          </span>
        </div>
      </div>

      {/* ── Right panel: thumbnail ── */}
      <div style={{ display: "flex", width: "600px", height: "630px", backgroundColor: navy, flexShrink: 0 }}>
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt="" style={{ width: "600px", height: "630px", objectFit: "cover" }} />
        ) : null}
      </div>

    </div>,
    { width: 1200, height: 630 }
  );
}
