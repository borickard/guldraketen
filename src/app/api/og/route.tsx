import { ImageResponse } from "next/og";
import { getVideoForRank } from "@/lib/getVideoForRank";

export const runtime = "nodejs";

async function loadGoogleFont(family: string, weights: number[], text?: string) {
  const params = new URLSearchParams({
    family: `${family}:wght@${weights.join(";")}`,
    display: "swap",
  });
  if (text) params.set("text", text);
  const css = await fetch(`https://fonts.googleapis.com/css2?${params}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  }).then((r) => r.text());

  const urls = [...css.matchAll(/src: url\((.+?)\) format\('(opentype|truetype|woff2)'\)/g)].map((m) => m[1]);
  return Promise.all(
    urls.map(async (url, i) => {
      const data = await fetch(url).then((r) => r.arrayBuffer());
      const weightMatch = css.split("src:")[i]?.match(/font-weight:\s*(\d+)/);
      return { data, weight: weightMatch ? (parseInt(weightMatch[1]) as 400 | 600 | 800) : 400 };
    })
  );
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
    const { searchParams } = new URL(req.url);
    const week = searchParams.get("week") ?? "";
    const rank = parseInt(searchParams.get("rank") ?? "0");

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
    const [barlowFonts, barlowCondensedFonts] = await Promise.all([
        loadGoogleFont("Barlow", [400, 600, 800]),
        loadGoogleFont("Barlow+Condensed", [600, 800]),
    ]);

    const fonts: ImageResponse["arguments"][1]["fonts"] = [
        ...barlowFonts.map((f) => ({ name: "Barlow", data: f.data, weight: f.weight, style: "normal" as const })),
        ...barlowCondensedFonts.map((f) => ({ name: "Barlow Condensed", data: f.data, weight: f.weight, style: "normal" as const })),
    ];

    return new ImageResponse(
        <div style={{ display: "flex", width: "1200px", height: "630px", fontFamily: "Barlow, sans-serif" }}>

            {/* ── Left panel: dark blue + text ── */}
            <div style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                width: "600px",
                height: "630px",
                backgroundColor: navy,
                padding: "56px 56px",
                gap: "14px",
                flexShrink: 0,
            }}>
                {/* Week */}
                <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "36px", fontWeight: 600, color: white, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    {weekLabel}
                </span>
                {/* Account name — magenta */}
                <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "75px", fontWeight: 800, color: magenta, lineHeight: 1.0, letterSpacing: "-0.01em" }}>
                    {accountName}
                </span>
                {/* Rank label + medal */}
                <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "42px", fontWeight: 600, color: white, letterSpacing: "0.01em" }}>
                    {rankLabel} {medal}
                </span>
                {/* ER — magenta number, white label below */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "10px" }}>
                    <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "84px", fontWeight: 800, color: magenta, lineHeight: 1 }}>
                        {er}
                    </span>
                    <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "36px", fontWeight: 600, color: white, letterSpacing: "0.08em" }}>
                        engagement rate
                    </span>
                </div>
            </div>

            {/* ── Right panel: thumbnail center-cropped to fill 600×630 ── */}
            <div style={{
                display: "flex",
                width: "600px",
                height: "630px",
                backgroundColor: navy,
                flexShrink: 0,
            }}>
                {thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={thumbnailUrl}
                        alt=""
                        style={{
                            width: "600px",
                            height: "630px",
                            objectFit: "cover",
                        }}
                    />
                ) : null}
            </div>

        </div>,
        { width: 1200, height: 630, fonts }
    );
}

