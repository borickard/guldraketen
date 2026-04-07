import { ImageResponse } from "next/og";
import { getVideoForRank } from "@/lib/getVideoForRank";

export const runtime = "edge";

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
  const { searchParams } = new URL(req.url);
  const week = searchParams.get("week") ?? "";
  const rank = parseInt(searchParams.get("rank") ?? "0");

  const [video, font600, font800] = await Promise.all([
    getVideoForRank(week, rank),
    fetch(new URL("./barlow-condensed-600.woff2", import.meta.url)).then((r) => r.arrayBuffer()),
    fetch(new URL("./barlow-condensed-800.woff2", import.meta.url)).then((r) => r.arrayBuffer()),
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

  const fonts = [
    { name: "Barlow Condensed", data: font600, weight: 600 as const, style: "normal" as const },
    { name: "Barlow Condensed", data: font800, weight: 800 as const, style: "normal" as const },
  ];

  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: navy }}>

      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: "50%", height: "100%", padding: "56px", gap: "14px" }}>
        <span style={{ fontFamily: "Barlow Condensed", fontSize: 36, fontWeight: 600, color: white, letterSpacing: "0.1em" }}>
          {weekLabel}
        </span>
        <span style={{ fontFamily: "Barlow Condensed", fontSize: 75, fontWeight: 800, color: magenta, lineHeight: 1 }}>
          {accountName}
        </span>
        <span style={{ fontFamily: "Barlow Condensed", fontSize: 42, fontWeight: 600, color: white }}>
          {rankLabel} {medal}
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "10px" }}>
          <span style={{ fontFamily: "Barlow Condensed", fontSize: 84, fontWeight: 800, color: magenta, lineHeight: 1 }}>
            {er}
          </span>
          <span style={{ fontFamily: "Barlow Condensed", fontSize: 36, fontWeight: 600, color: white, letterSpacing: "0.08em" }}>
            engagement rate
          </span>
        </div>
      </div>

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
