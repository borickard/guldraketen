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

  // Try to load fonts — if anything fails, fall back to sans-serif
  let fonts: { name: string; data: ArrayBuffer; weight: 600 | 800; style: "normal" }[] = [];
  let fontFamily = "sans-serif";
  try {
    const [f600, f800] = await Promise.all([
      fetch(new URL("./barlow-condensed-600.woff2", import.meta.url)).then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.arrayBuffer();
      }),
      fetch(new URL("./barlow-condensed-800.woff2", import.meta.url)).then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.arrayBuffer();
      }),
    ]);
    fonts = [
      { name: "Barlow Condensed", data: f600, weight: 600, style: "normal" },
      { name: "Barlow Condensed", data: f800, weight: 800, style: "normal" },
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
  const medal = RANK_MEDALS[String(rank)] ?? "";
  const weekLabel = weekNum ? `Vecka ${weekNum}` : "";
  const thumbnailUrl = video?.thumbnail_url ?? null;

  const navy = "#07253A";
  const white = "#ffffff";
  const magenta = "rgb(254,44,85)";

  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: navy }}>

      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: "50%", height: "100%", padding: "56px", gap: "14px" }}>
        <span style={{ fontFamily, fontSize: 36, fontWeight: 600, color: white, letterSpacing: "0.1em" }}>
          {weekLabel}
        </span>
        <span style={{ fontFamily, fontSize: 75, fontWeight: 800, color: magenta, lineHeight: 1 }}>
          {accountName}
        </span>
        <span style={{ fontFamily, fontSize: 42, fontWeight: 600, color: white }}>
          {rankLabel} {medal}
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "10px" }}>
          <span style={{ fontFamily, fontSize: 84, fontWeight: 800, color: magenta, lineHeight: 1 }}>
            {er}
          </span>
          <span style={{ fontFamily, fontSize: 36, fontWeight: 600, color: white, letterSpacing: "0.08em" }}>
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
