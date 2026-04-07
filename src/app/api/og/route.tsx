import { ImageResponse } from "next/og";
import { getVideoForRank } from "@/lib/getVideoForRank";

export const runtime = "nodejs";

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
    const dim = "rgba(237,248,251,0.55)";

    return new ImageResponse(
        <div style={{ display: "flex", width: "1200px", height: "630px", fontFamily: "sans-serif" }}>

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
                <span style={{ fontSize: "27px", color: dim, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    {weekLabel}
                </span>
                {/* Account name — magenta */}
                <span style={{ fontSize: "75px", fontWeight: 800, color: magenta, lineHeight: 1.0, letterSpacing: "-0.01em" }}>
                    {accountName}
                </span>
                {/* Rank label + medal */}
                <span style={{ fontSize: "42px", fontWeight: 600, color: white, letterSpacing: "0.01em" }}>
                    {rankLabel} {medal}
                </span>
                {/* ER — magenta number, white label */}
                <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginTop: "10px" }}>
                    <span style={{ fontSize: "84px", fontWeight: 800, color: magenta, lineHeight: 1 }}>
                        {er}
                    </span>
                    <span style={{ fontSize: "24px", color: dim, letterSpacing: "0.08em", textTransform: "uppercase" }}>
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
        { width: 1200, height: 630 }
    );
}

