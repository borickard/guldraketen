import { ImageResponse } from "next/og";
import { getVideoForRank } from "@/lib/getVideoForRank";

export const runtime = "nodejs";

const RANK_COLORS: Record<string, string> = {
    "1": "#C8962A",
    "2": "#8A9299",
    "3": "#96614A",
};
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
    const rankColor = RANK_COLORS[String(rank)] ?? "#EDF8FB";
    const rankLabel = RANK_LABELS[String(rank)] ?? `Plats ${rank}`;
    const medal = RANK_MEDALS[String(rank)] ?? "";
    const weekLabel = weekNum ? `Vecka ${weekNum}` : "";
    const thumbnailUrl = video?.thumbnail_url ?? null;

    const navy = "#07253A";
    const white = "#EDF8FB";
    const dim = "rgba(237,248,251,0.65)";

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
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        objectPosition: "top center",
                    }}
                />
            ) : null}

            {/* Gradient overlay — taller for more text room */}
            <div
                style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    width: "100%",
                    height: "360px",
                    background: "linear-gradient(transparent, rgba(7,37,58,0.97))",
                    display: "flex",
                }}
            />

            {/* Overlay text */}
            <div
                style={{
                    position: "absolute",
                    bottom: "48px",
                    left: "60px",
                    right: "60px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                }}
            >
                {/* Week label */}
                <div style={{ display: "flex", alignItems: "center", gap: "0" }}>
                    <span style={{ fontSize: "26px", color: dim, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                        {weekLabel}
                    </span>
                </div>

                {/* Account name */}
                <div style={{ display: "flex" }}>
                    <span style={{ fontSize: "56px", fontWeight: 800, color: white, lineHeight: 1, letterSpacing: "-0.01em" }}>
                        {accountName}
                    </span>
                </div>

                {/* Rank label */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "36px", fontWeight: 700, color: rankColor, letterSpacing: "0.02em" }}>
                        {rankLabel} {medal}
                    </span>
                    <span style={{ fontSize: "26px", color: dim, letterSpacing: "0.04em" }}>
                        · {er} engagement rate
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

