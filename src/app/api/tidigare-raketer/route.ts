import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

const MIN_VIDEO_VIEWS = 10_000;
const MIN_ACCOUNTS_PER_WEEK = 5;

function toISOWeek(date: Date): string {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const week1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const weekNum =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getUTCDay() + 6) % 7)) /
        7
    );
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function currentAndPreviousWeek(): [string, string] {
  const now = new Date();
  const curr = toISOWeek(now);
  const prev = toISOWeek(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  return [curr, prev];
}

type VideoEntry = {
  rank: number;
  handle: string;
  displayName: string;
  bestVideo: {
    video_url: string;
    thumbnail_url: string | null;
    caption: string | null;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    engagement_rate: number;
  };
};

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("videos")
    .select("handle, views, likes, comments, shares, engagement_rate, published_at, thumbnail_url, caption, video_url, accounts(display_name, followers)")
    .not("published_at", "is", null)
    .or("is_contest.eq.false,contest_approved.eq.true")
    .order("published_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const [currentWeek, previousWeek] = currentAndPreviousWeek();

  // Group by week
  const byWeek = new Map<string, typeof data>();
  for (const v of data ?? []) {
    const week = toISOWeek(new Date(v.published_at!));
    if (week === currentWeek || week === previousWeek) continue;
    const list = byWeek.get(week) ?? [];
    list.push(v);
    byWeek.set(week, list);
  }

  const weekGroups: { week: string; entries: VideoEntry[] }[] = [];

  for (const [week, videos] of byWeek) {
    const byAccount = new Map<string, typeof data>();
    for (const v of videos) {
      if ((v.views ?? 0) < MIN_VIDEO_VIEWS) continue;
      const list = byAccount.get(v.handle) ?? [];
      list.push(v);
      byAccount.set(v.handle, list);
    }

    if (byAccount.size < MIN_ACCOUNTS_PER_WEEK) continue;

    // Rank top accounts by best video engagement_rate
    const ranked = [...byAccount.entries()]
      .map(([handle, vids]) => {
        const best = vids.reduce((a, b) =>
          (b.engagement_rate ?? 0) > (a.engagement_rate ?? 0) ? b : a
        );
        const acct = Array.isArray(best.accounts) ? best.accounts[0] : best.accounts;
        return {
          handle,
          displayName: acct?.display_name ?? `@${handle}`,
          bestVideo: best,
        };
      })
      .sort((a, b) => (b.bestVideo.engagement_rate ?? 0) - (a.bestVideo.engagement_rate ?? 0));

    if (ranked.length === 0) continue;

    weekGroups.push({
      week,
      entries: ranked.slice(0, 3).map((r, i) => ({
        rank: i + 1,
        handle: r.handle,
        displayName: r.displayName,
        bestVideo: {
          video_url: r.bestVideo.video_url,
          thumbnail_url: r.bestVideo.thumbnail_url,
          caption: r.bestVideo.caption,
          views: r.bestVideo.views ?? 0,
          likes: r.bestVideo.likes ?? 0,
          comments: r.bestVideo.comments ?? 0,
          shares: r.bestVideo.shares ?? 0,
          engagement_rate: r.bestVideo.engagement_rate ?? 0,
        },
      })),
    });
  }

  // Sort newest week first
  weekGroups.sort((a, b) => (b.week > a.week ? 1 : -1));

  const res = NextResponse.json(weekGroups);
  res.headers.set("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  return res;
}
