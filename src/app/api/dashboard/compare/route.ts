import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifySession, COOKIE_NAME } from "@/lib/dashboardAuth";

type Period = "30d" | "90d" | "all";

function periodToDays(p: Period): number | null {
  if (p === "30d") return 30;
  if (p === "90d") return 90;
  return null;
}

function parsePeriod(s: string | null): Period {
  if (s === "90d" || s === "all") return s;
  return "30d";
}

interface VideoRow {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  collect_count: number | null;
  engagement_rate: number | null;
  published_at: string | null;
}

interface Benchmarks {
  avg_er: number | null;
  avg_views: number | null;
  avg_likes: number | null;
  avg_comments: number | null;
  avg_shares: number | null;
  avg_collects: number | null;
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_collects: number;
  posts_per_week: number | null;
}

function aggregate(videos: VideoRow[], days: number | null): Benchmarks {
  const n = videos.length;
  const sum = videos.reduce(
    (acc, v) => {
      acc.views += v.views ?? 0;
      acc.likes += v.likes ?? 0;
      acc.comments += v.comments ?? 0;
      acc.shares += v.shares ?? 0;
      acc.collects += v.collect_count ?? 0;
      return acc;
    },
    { views: 0, likes: 0, comments: 0, shares: 0, collects: 0 }
  );

  const erValues = videos
    .filter((v) => v.engagement_rate != null)
    .map((v) => Number(v.engagement_rate));
  const avg_er =
    erValues.length > 0 ? erValues.reduce((s, x) => s + x, 0) / erValues.length : null;

  let weeksSpan: number;
  if (days != null) {
    weeksSpan = days / 7;
  } else {
    const timestamps = videos
      .filter((v) => v.published_at)
      .map((v) => new Date(v.published_at!).getTime());
    const spanMs =
      timestamps.length >= 2 ? Math.max(...timestamps) - Math.min(...timestamps) : 0;
    weeksSpan = Math.max(spanMs / (7 * 24 * 3600 * 1000), 1);
  }
  const posts_per_week = n > 0 ? n / weeksSpan : null;

  return {
    avg_er: avg_er != null ? parseFloat(avg_er.toFixed(4)) : null,
    avg_views: n > 0 ? Math.round(sum.views / n) : null,
    avg_likes: n > 0 ? Math.round(sum.likes / n) : null,
    avg_comments: n > 0 ? Math.round(sum.comments / n) : null,
    avg_shares: n > 0 ? Math.round(sum.shares / n) : null,
    avg_collects: n > 0 ? Math.round(sum.collects / n) : null,
    total_views: sum.views,
    total_likes: sum.likes,
    total_comments: sum.comments,
    total_shares: sum.shares,
    total_collects: sum.collects,
    posts_per_week: posts_per_week != null ? parseFloat(posts_per_week.toFixed(2)) : null,
  };
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const handlesParam = req.nextUrl.searchParams.get("handles");
  if (!handlesParam) return NextResponse.json([]);

  const requested = handlesParam
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  if (requested.length === 0) return NextResponse.json([]);

  const period = parsePeriod(req.nextUrl.searchParams.get("period"));
  const days = periodToDays(period);

  const { data: accounts } = await supabaseAdmin
    .from("accounts")
    .select("handle, display_name, avatar_url, category, followers")
    .in("handle", requested);

  const accountByHandle = new Map(
    (accounts ?? []).map((a) => [a.handle, a])
  );

  const cutoffIso =
    days != null ? new Date(Date.now() - days * 86400000).toISOString() : null;

  let videoQuery = supabaseAdmin
    .from("videos")
    .select("handle, views, likes, comments, shares, collect_count, engagement_rate, published_at")
    .in("handle", requested)
    .or("is_contest.eq.false,contest_approved.eq.true");
  if (cutoffIso) videoQuery = videoQuery.gte("published_at", cutoffIso);

  const { data: videos, error } = await videoQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const videosByHandle = new Map<string, VideoRow[]>();
  for (const v of videos ?? []) {
    const list = videosByHandle.get(v.handle) ?? [];
    list.push(v);
    videosByHandle.set(v.handle, list);
  }

  const ownHandles = new Set(session.handles);

  const result = requested
    .map((h) => {
      const acc = accountByHandle.get(h);
      if (!acc) return null;
      const handleVideos = videosByHandle.get(h) ?? [];
      return {
        handle: acc.handle,
        display_name: acc.display_name,
        avatar_url: acc.avatar_url,
        category: acc.category,
        followers: acc.followers,
        is_self: ownHandles.has(acc.handle),
        period: { days, video_count: handleVideos.length },
        benchmarks: aggregate(handleVideos, days),
      };
    })
    .filter(Boolean);

  return NextResponse.json(result);
}
