import { ImageResponse } from "next/og";
import { getVideoForRank } from "@/lib/getVideoForRank";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

function loadFont(weight: 600 | 800): ArrayBuffer {
  const file = path.join(process.cwd(), `public/fonts/barlow-condensed-${weight}.woff2`);
  const buf = fs.readFileSync(file);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
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
  try {
    return await handleOG(req);
  } catch (err) {
    console.error("OG route error:", err);
    return new Response(`OG image error: ${err instanceof Error ? err.message : String(err)}`, { status: 500 });
  }
}

async function handleOG(req: Request) {
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
    const fonts = [
        { name: "Barlow Condensed", data: loadFont(600), weight: 600 as const, style: "normal" as const },
        { name: "Barlow Condensed", data: loadFont(800), weight: 800 as const, style: "normal" as const },
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

