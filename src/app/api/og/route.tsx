import { ImageResponse } from "next/og";
import { getVideoForRank } from "@/lib/getVideoForRank";

export const runtime = "nodejs";

const RANK_COLORS: Record<string, string> = {
    "1": "#C8962A",
    "2": "#8A9299",
    "3": "#96614A",
};
const RANK_LABELS: Record<string, string> = {
    "1": "GULD",
    "2": "SILVER",
    "3": "BRONS",
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
    const rankLabel = RANK_LABELS[String(rank)] ?? `PLATS ${rank}`;
    const weekLabel = weekNum ? `Vecka ${weekNum}` : "";
    const thumbnailUrl = video?.thumbnail_url ?? null;

    const navy = "#07253A";
    const dim = "rgba(237,248,251,0.5)";
    const white = "#EDF8FB";

    return new ImageResponse(
        <div
            style={{
                display: "flex",
                width: "1200px",
                height: "630px",
                fontFamily: "sans-serif",
                backgroundColor: navy,
            }}
        >
            {/* Left: thumbnail */}
            {thumbnailUrl && (
                <div
                    style={{
                        width: "420px",
                        height: "630px",
                        flexShrink: 0,
                        overflow: "hidden",
                        display: "flex",
                    }}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={thumbnailUrl}
                        alt=""
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            objectPosition: "top center",
                        }}
                    />
                </div>
            )}

            {/* Right: stats panel */}
            <div
                style={{
                    flex: 1,
                    backgroundColor: navy,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    padding: "56px 60px",
                    gap: "0px",
                }}
            >
                {/* Brand */}
                <div
                    style={{
                        fontSize: "13px",
                        letterSpacing: "0.12em",
                        color: dim,
                        textTransform: "uppercase",
                        marginBottom: "28px",
                    }}
                >
                    SOCIALA RAKETER
                </div>

                {/* Rank + week */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        marginBottom: "20px",
                    }}
                >
                    <span
                        style={{
                            fontSize: "18px",
                            fontWeight: 700,
                            color: rankColor,
                            letterSpacing: "0.08em",
                        }}
                    >
                        {rankLabel}
                    </span>
                    {weekLabel && (
                        <span style={{ fontSize: "16px", color: dim }}>
                            · {weekLabel}
                        </span>
                    )}
                </div>

                {/* Account name */}
                <div
                    style={{
                        fontSize: "38px",
                        fontWeight: 700,
                        color: white,
                        lineHeight: 1.15,
                        marginBottom: "32px",
                        maxWidth: "600px",
                    }}
                >
                    {accountName}
                </div>

                {/* ER value */}
                <div
                    style={{
                        fontSize: "72px",
                        fontWeight: 800,
                        color: rankColor,
                        lineHeight: 1,
                        marginBottom: "8px",
                    }}
                >
                    {er}
                </div>

                {/* ER label */}
                <div
                    style={{
                        fontSize: "14px",
                        letterSpacing: "0.1em",
                        color: dim,
                        textTransform: "uppercase",
                    }}
                >
                    engagement rate
                </div>
            </div>
        </div>,
        {
            width: 1200,
            height: 630,
        }
    );
}
