import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

const MIN_VIDEO_VIEWS = 10_000;
const MIN_ACCOUNTS_PER_WEEK = 5;
const TOP_N = 20;

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

export type HofVideo = {
  rank: number;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  category: string | null;
  video: {
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

export type HofWeek = {
  week: string;
  videos: HofVideo[];
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoryFilter = searchParams.get("category") ?? "";

  let query = supabaseAdmin
    .from("videos")
    .select(
      "handle, views, likes, comments, shares, engagement_rate, published_at, thumbnail_url, caption, video_url, accounts(display_name, category, avatar_url)"
    )
    .not("published_at", "is", null)
    .or("is_contest.eq.false,contest_approved.eq.true")
    .gte("views", MIN_VIDEO_VIEWS)
    .not("engagement_rate", "is", null)
    .order("engagement_rate", { ascending: false });

  if (categoryFilter) {
    // Get handles for accounts in the requested category
    const { data: acctHandles } = await supabaseAdmin
      .from("accounts")
      .select("handle")
      .eq("category", categoryFilter);
    const handles = (acctHandles ?? []).map((a) => a.handle);
    if (handles.length === 0) return NextResponse.json([]);
    query = query.in("handle", handles);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const [currentWeek, previousWeek] = currentAndPreviousWeek();

  // Group by week — already sorted by ER desc from query
  const byWeek = new Map<string, typeof data>();
  for (const v of data ?? []) {
    const week = toISOWeek(new Date(v.published_at!));
    if (week === currentWeek || week === previousWeek) continue;
    const list = byWeek.get(week) ?? [];
    list.push(v);
    byWeek.set(week, list);
  }

  const weekGroups: HofWeek[] = [];

  for (const [week, videos] of byWeek) {
    const uniqueAccounts = new Set(videos.map((v) => v.handle));
    // When browsing all categories, require at least MIN_ACCOUNTS_PER_WEEK to avoid thin weeks.
    // When filtered to a specific category, any week with content is valid.
    if (!categoryFilter && uniqueAccounts.size < MIN_ACCOUNTS_PER_WEEK) continue;

    const top = videos.slice(0, TOP_N).map((v, i) => {
      const acct = Array.isArray(v.accounts) ? v.accounts[0] : v.accounts;
      const acctEx = acct as { display_name?: string | null; category?: string | null; avatar_url?: string | null } | null;
      return {
        rank: i + 1,
        handle: v.handle,
        displayName: acctEx?.display_name ?? `@${v.handle}`,
        avatarUrl: acctEx?.avatar_url ?? null,
        category: acctEx?.category ?? null,
        video: {
          video_url: v.video_url,
          thumbnail_url: v.thumbnail_url,
          caption: v.caption,
          views: v.views ?? 0,
          likes: v.likes ?? 0,
          comments: v.comments ?? 0,
          shares: v.shares ?? 0,
          engagement_rate: Number(v.engagement_rate),
        },
      };
    });

    weekGroups.push({ week, videos: top });
  }

  weekGroups.sort((a, b) => (b.week > a.week ? 1 : -1));

  const res = NextResponse.json(weekGroups);
  res.headers.set("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  return res;
}
