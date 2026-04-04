import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextRequest, NextResponse } from "next/server";

const MIN_VIDEO_VIEWS = 10_000;
const MIN_ACCOUNTS_PER_WEEK = 5;

function toISOWeek(date: Date): string {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const week1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const weekNum =
    1 + Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7
    );
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function currentAndPreviousWeek(): [string, string] {
  const now = new Date();
  const curr = toISOWeek(now);
  const prev = toISOWeek(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  return [curr, prev];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;

  // 1. Fetch account row
  const { data: account, error: accErr } = await supabaseAdmin
    .from("accounts")
    .select("handle, display_name, avatar_url, followers, category, created_at")
    .eq("handle", handle)
    .maybeSingle();

  if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 });
  if (!account) return NextResponse.json({ error: "Konto hittades inte" }, { status: 404 });

  // 2. Fetch all videos for this handle
  const { data: videos, error: vidErr } = await supabaseAdmin
    .from("videos")
    .select("id, video_url, published_at, views, likes, comments, shares, engagement_rate, thumbnail_url, caption")
    .eq("handle", handle)
    .or("is_contest.eq.false,contest_approved.eq.true")
    .order("published_at", { ascending: false })
    .limit(500);

  if (vidErr) return NextResponse.json({ error: vidErr.message }, { status: 500 });

  // 3. Compute basic stats from this account's videos
  const qualifying = (videos ?? []).filter(
    (v) => (v.views ?? 0) >= MIN_VIDEO_VIEWS && v.engagement_rate != null
  );
  const avgEr = qualifying.length
    ? qualifying.reduce((s, v) => s + Number(v.engagement_rate), 0) / qualifying.length
    : null;
  const bestEr = qualifying.length
    ? Math.max(...qualifying.map((v) => Number(v.engagement_rate)))
    : null;

  // 4. Compute top-3 finish counts by re-running the weekly ranking across all accounts
  const [currentWeek, previousWeek] = currentAndPreviousWeek();

  const { data: allVideos } = await supabaseAdmin
    .from("videos")
    .select("handle, views, engagement_rate, published_at")
    .not("published_at", "is", null)
    .or("is_contest.eq.false,contest_approved.eq.true")
    .gte("views", MIN_VIDEO_VIEWS);

  let gold = 0, silver = 0, bronze = 0;

  if (allVideos) {
    const byWeek = new Map<string, typeof allVideos>();
    for (const v of allVideos) {
      const week = toISOWeek(new Date(v.published_at!));
      if (week === currentWeek || week === previousWeek) continue;
      const list = byWeek.get(week) ?? [];
      list.push(v);
      byWeek.set(week, list);
    }

    for (const [, weekVideos] of byWeek) {
      const byAccount = new Map<string, number>();
      for (const v of weekVideos) {
        const cur = byAccount.get(v.handle) ?? 0;
        byAccount.set(v.handle, Math.max(cur, v.engagement_rate ?? 0));
      }
      if (byAccount.size < MIN_ACCOUNTS_PER_WEEK) continue;

      const ranked = [...byAccount.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([h], idx) => ({ h, rank: idx + 1 }));

      for (const { h, rank } of ranked) {
        if (h !== handle) continue;
        if (rank === 1) gold++;
        else if (rank === 2) silver++;
        else if (rank === 3) bronze++;
      }
    }
  }

  const res = NextResponse.json({
    account,
    stats: {
      avgEr: avgEr != null ? parseFloat(avgEr.toFixed(4)) : null,
      bestEr: bestEr != null ? parseFloat(Number(bestEr).toFixed(4)) : null,
      videoCount: (videos ?? []).length,
      firstTracked: account.created_at,
      topFinishes: { gold, silver, bronze },
    },
    videos: videos ?? [],
  });

  res.headers.set("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  return res;
}
