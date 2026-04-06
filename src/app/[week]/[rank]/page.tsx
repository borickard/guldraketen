import type { Metadata } from "next";
import SharePageClient from "./SharePageClient";
import { getVideoForRank } from "@/lib/getVideoForRank";

const RANK_MAP: Record<string, number> = { guld: 1, silver: 2, brons: 3 };
const RANK_LABELS: Record<string, string> = { guld: "Guld 🥇", silver: "Silver 🥈", brons: "Brons 🥉" };

export async function generateMetadata({
    params,
}: {
    params: Promise<{ week: string; rank: string }>;
}): Promise<Metadata> {
    const { week, rank: rankParam } = await params;
    const rankNum = RANK_MAP[rankParam] ?? (parseInt(rankParam.replace("top", "")) || 0);
    const video = await getVideoForRank(week, rankNum);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://guldraketen.vercel.app";
    const weekNum = parseInt(week.split("-W")[1]);

    const acct = Array.isArray(video?.accounts) ? video?.accounts[0] : video?.accounts;
    const accountName = acct?.display_name ?? (video ? `@${video.handle}` : "Okänt konto");
    const er = video?.engagement_rate != null
        ? Number(video.engagement_rate).toFixed(2).replace(".", ",")
        : "–";
    const rankLabel = RANK_LABELS[rankParam] ?? `Plats ${rankNum}`;
    const rankLabelPlain = rankParam === "guld" ? "guld" : rankParam === "silver" ? "silver" : rankParam === "brons" ? "brons" : `plats ${rankNum}`;

    const title = `${accountName} — Veckans Raket ${rankLabel}`;
    const description = `${accountName} tog ${rankLabelPlain}platsen vecka ${weekNum} med ${er}% engagement rate. Sociala Raketer rankar Sveriges mest engagerande TikTok-konton.`;
    const ogImage = `${siteUrl}/api/og?week=${week}&rank=${rankNum}`;
    const pageUrl = `${siteUrl}/${week}/${rankParam}`;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            url: pageUrl,
            images: [{ url: ogImage, width: 1200, height: 630 }],
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [ogImage],
        },
    };
}

export default function Page() {
    return <SharePageClient />;
}
