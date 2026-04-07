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

    return new ImageResponse(
        <div
            style={{
                display: "flex",
                width: "1200px",
                height: "630px",
                fontFamily: "sans-serif",
                backgroundColor: navy,
                position: "relative",
            }}
        >
            {/* Full-bleed thumbnail */}
            {thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={thumbnailUrl}
                    alt=""
                    style={{
                        position: "absolute",
                        top: "-700px",
                        left: 0,
                        width: "1200px",
                        height: "2133px",
                    }}
                />
            ) : null}

            {/* Magenta gradient overlay */}
            <div
                style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    width: "100%",
                    height: "760px",
                    background: "linear-gradient(transparent, rgba(190,20,110,0.97))",
                    display: "flex",
                }}
            />

            {/* Overlay text — medal left, text block right */}
            <div
                style={{
                    position: "absolute",
                    bottom: "48px",
                    left: "60px",
                    right: "60px",
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: "28px",
                }}
            >
                {/* Medal emoji — same height as the text block */}
                <div style={{ display: "flex", fontSize: "130px", lineHeight: 1 }}>
                    {medal}
                </div>

                {/* Text block */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span style={{ fontSize: "24px", color: white, opacity: 0.75, letterSpacing: "0.07em", textTransform: "uppercase" }}>
                        {weekLabel}
                    </span>
                    <span style={{ fontSize: "58px", fontWeight: 800, color: white, lineHeight: 1, letterSpacing: "-0.01em" }}>
                        {accountName}
                    </span>
                    <span style={{ fontSize: "34px", fontWeight: 600, color: white, letterSpacing: "0.01em" }}>
                        {rankLabel} · {er} engagement rate
                    </span>
                </div>
            </div>
        </div>,
        {
            width: 1200,
            height: 630,
        }
    );
}

