import type { Metadata } from "next";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://guldraketen.vercel.app";

function toISOWeek(date: Date): string {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const week1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function prevWeek(weekStr: string): string {
  const [yr, wk] = weekStr.split("-W").map(Number);
  const jan4 = new Date(Date.UTC(yr, 0, 4));
  const mon = new Date(jan4);
  mon.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (wk - 1) * 7 - 7);
  return toISOWeek(mon);
}

function getMostRecentPublishedWeek(): string {
  // current and previous weeks are unpublished — go 2 back
  return prevWeek(prevWeek(toISOWeek(new Date())));
}

function isPublishedWeek(weekStr: string): boolean {
  const current = toISOWeek(new Date());
  const previous = prevWeek(current);
  return /^\d{4}-W\d{2}$/.test(weekStr) && weekStr !== current && weekStr !== previous;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}): Promise<Metadata> {
  const { week: weekParam } = await searchParams;
  const week = (weekParam && isPublishedWeek(weekParam)) ? weekParam : getMostRecentPublishedWeek();
  const weekNum = parseInt(week.split("-W")[1]);
  const year = week.split("-W")[0];

  const title = "Sociala Raketer – Veckans mest engagerande TikTok-konton";
  const description = `Rankar Sveriges mest engagerande företag och organisationer på TikTok vecka för vecka. Se veckans topplista – V${weekNum} ${year}.`;
  const ogImage = `${SITE_URL}/api/og/home?week=${week}&v=5`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: SITE_URL,
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
  return <HomeClient />;
}
