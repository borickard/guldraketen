import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifySession, COOKIE_NAME } from "@/lib/dashboardAuth";

// Returns hero data for a single handle: follower trend + per-video benchmarks.

const TREND_DAYS = 30;

// Temporary toggle for previewing the follower-trend UI with synthetic data
// before we have enough real history accumulated. Flip back to false before
// any user-facing release.
const USE_FAKE_FOLLOWER_HISTORY = false;

function fakeFollowerHistory(): { date: string; followers: number }[] {
  // 14 datapoints spread across the last 30 days, mid-low growth on a
  // small-account profile so rounding noise doesn't kick in.
  const seed = [1500, 1510, 1530, 1545, 1555, 1570, 1620, 1680, 1720, 1740, 1760, 1790, 1830, 1890];
  const daysAgo = [30, 28, 25, 22, 20, 18, 15, 12, 10, 8, 6, 4, 2, 0];
  return seed.map((followers, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - daysAgo[i]);
    return { date: d.toISOString().slice(0, 10), followers };
  });
}

function roundingStep(followers: number): number {
  if (followers < 1000) return 1;
  if (followers < 10000) return 10;
  if (followers < 100000) return 100;
  if (followers < 1000000) return 1000;
  return 100000;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const handle = req.nextUrl.searchParams.get("handle");
  if (!handle || !session.handles.includes(handle)) {
    return NextResponse.json({ error: "Forbidden handle" }, { status: 403 });
  }

  // Current followers + identity
  const { data: account } = await supabaseAdmin
    .from("accounts")
    .select("handle, display_name, avatar_url, followers, created_at")
    .eq("handle", handle)
    .single();

  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Follower history — last TREND_DAYS days
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - TREND_DAYS);
  const sinceDate = since.toISOString().slice(0, 10);

  const { data: history } = await supabaseAdmin
    .from("follower_history")
    .select("captured_date, followers")
    .eq("handle", handle)
    .gte("captured_date", sinceDate)
    .order("captured_date", { ascending: true });

  let points = (history ?? []).map((h) => ({
    date: h.captured_date as string,
    followers: h.followers as number,
  }));

  // Synthetic data overlay for previewing the trend UI before we've
  // accumulated enough real history. Disable before deploying live.
  if (USE_FAKE_FOLLOWER_HISTORY) {
    points = fakeFollowerHistory();
  }

  // Delta: compare oldest in window vs current followers
  const currentRealOrFake = USE_FAKE_FOLLOWER_HISTORY
    ? points[points.length - 1]?.followers ?? 0
    : account.followers ?? (points.length > 0 ? points[points.length - 1].followers : 0);
  const current = currentRealOrFake;
  const earliest = points.length > 0 ? points[0].followers : null;
  const step = roundingStep(current);
  let delta: { abs: number; pct: number; meaningful: boolean; days: number } | null = null;
  if (earliest != null && current != null && points.length > 0) {
    const days = Math.max(
      1,
      Math.round(
        (new Date(points[points.length - 1].date).getTime() - new Date(points[0].date).getTime()) /
          86400000
      )
    );
    const abs = current - earliest;
    const pct = earliest > 0 ? (abs / earliest) * 100 : 0;
    const meaningful = Math.abs(abs) >= step * 2; // larger than 2× rounding floor
    delta = { abs, pct, meaningful, days };
  }

  // Per-video averages (all-time, for hero benchmarks).
  // Reads from dashboard_videos so freshness matches what the user sees in
  // the grid below; no contest filter — those flags only matter for the
  // public ranking and aren't tracked here.
  const boost = req.nextUrl.searchParams.get("boost") ?? "all";
  let videosQuery = supabaseAdmin
    .from("dashboard_videos")
    .select("views, likes, comments, shares, collect_count, engagement_rate, published_at")
    .eq("handle", handle)
    .eq("is_excluded", false);
  if (boost === "organic") videosQuery = videosQuery.eq("is_ad", false);
  else if (boost === "boosted") videosQuery = videosQuery.eq("is_ad", true);
  const { data: videos } = await videosQuery;

  const vids = videos ?? [];
  const count = vids.length;
  const sumOf = (k: keyof (typeof vids)[number]) => {
    const nums = vids.map((v) => Number(v[k] ?? 0)).filter((n) => !isNaN(n));
    return nums.reduce((s, n) => s + n, 0);
  };
  const avgOf = (k: keyof (typeof vids)[number]) => (count === 0 ? 0 : sumOf(k) / count);
  const collectVids = vids.filter((v) => v.collect_count != null);
  const totalCollects = collectVids.length > 0
    ? collectVids.reduce((s, v) => s + Number(v.collect_count ?? 0), 0)
    : null;
  const avgCollects = collectVids.length > 0 ? totalCollects! / collectVids.length : null;

  // Posts-per-week computed from actual span (matches existing dashboard logic)
  const timestamps = vids
    .filter((v) => v.published_at)
    .map((v) => new Date(v.published_at!).getTime());
  const spanMs = timestamps.length >= 2 ? Math.max(...timestamps) - Math.min(...timestamps) : 0;
  const weeksSpan = Math.max(spanMs / (7 * 24 * 3600 * 1000), 1);
  const postsPerWeek = count / weeksSpan;

  // Latest cron timestamp for this handle — most recent dashboard_videos
  // last_updated, with accounts.followers_updated_at as fallback for handles
  // that haven't been scraped yet.
  const { data: freshRow } = await supabaseAdmin
    .from("dashboard_videos")
    .select("last_updated")
    .eq("handle", handle)
    .order("last_updated", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: accountFresh } = await supabaseAdmin
    .from("accounts")
    .select("followers_updated_at")
    .eq("handle", handle)
    .maybeSingle();

  const lastFetchedAt: string | null =
    freshRow?.last_updated ?? accountFresh?.followers_updated_at ?? null;

  return NextResponse.json({
    handle: account.handle,
    display_name: account.display_name,
    avatar_url: account.avatar_url,
    tracked_since: account.created_at,
    last_fetched_at: lastFetchedAt,
    followers: {
      current,
      history: points,
      delta,
      rounding_step: step,
    },
    benchmarks: {
      videos: count,
      posts_per_week: postsPerWeek,
      total_views: sumOf("views"),
      total_likes: sumOf("likes"),
      total_comments: sumOf("comments"),
      total_shares: sumOf("shares"),
      total_collects: totalCollects,
      avg_views: avgOf("views"),
      avg_likes: avgOf("likes"),
      avg_comments: avgOf("comments"),
      avg_shares: avgOf("shares"),
      avg_collects: avgCollects,
      avg_er: avgOf("engagement_rate"),
    },
  });
}
