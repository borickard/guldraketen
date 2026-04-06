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

            {/* Gradient overlay */}
            <div
                style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    width: "100%",
                    height: "220px",
                    background: "linear-gradient(transparent, rgba(7,37,58,0.92))",
                    display: "flex",
                }}
            />

            {/* Overlay text */}
            <div
                style={{
                    position: "absolute",
                    bottom: "44px",
                    left: "52px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                }}
            >
                {/* Rank + week + account */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                    }}
                >
                    <span
                        style={{
                            fontSize: "16px",
                            fontWeight: 700,
                            color: rankColor,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                        }}
                    >
                        {rankLabel}
                    </span>
                    {weekLabel && (
                        <span style={{ fontSize: "15px", color: dim }}>
                            · {weekLabel}
                        </span>
                    )}
                    <span style={{ fontSize: "15px", color: dim }}>
                        · {accountName}
                    </span>
                </div>

                {/* ER row */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: "10px",
                    }}
                >
                    <span
                        style={{
                            fontSize: "64px",
                            fontWeight: 800,
                            color: rankColor,
                            lineHeight: 1,
                        }}
                    >
                        {er}
                    </span>
                    <span
                        style={{
                            fontSize: "14px",
                            color: dim,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                        }}
                    >
                        engagement rate
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
