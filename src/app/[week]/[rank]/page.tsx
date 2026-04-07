import type { Metadata } from "next";
import SharePageClient from "./SharePageClient";
import { getVideoForRank } from "@/lib/getVideoForRank";

const RANK_MAP: Record<string, number> = { guld: 1, silver: 2, brons: 3 };
const RANK_ROCKET_LABEL: Record<string, string> = { guld: "Guldraket", silver: "Silverraket", brons: "Bronsraket" };
const RANK_MEDAL: Record<string, string> = { guld: "🥇", silver: "🥈", brons: "🥉" };

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
    const rocketLabel = RANK_ROCKET_LABEL[rankParam] ?? `Plats ${rankNum}`;
    const medal = RANK_MEDAL[rankParam] ?? "";

    const title = `${accountName} är ${rocketLabel} vecka ${weekNum}! ${medal}`;
    const description = `${accountName}s video hade ${er}% engagement rate. Sociala Raketer rankar Sveriges mest engagerande företag och organisationer på TikTok.`;
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
