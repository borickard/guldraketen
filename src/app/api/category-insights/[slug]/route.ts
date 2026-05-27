import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { unslugifyCategory } from "@/lib/categories";

const PERIOD_DAYS = 90;

interface VideoRow {
  handle: string;
  engagement_rate: number | null;
  published_at: string | null;
  views: number | null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const category = unslugifyCategory(slug);
  if (!category) {
    return NextResponse.json({ error: "Okänd kategori" }, { status: 404 });
  }

  const { data: accounts, error: accErr } = await supabaseAdmin
    .from("accounts")
    .select("handle, display_name, avatar_url, followers, created_at")
    .eq("is_active", true)
    .eq("category", category);
  if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 });

  const handles = (accounts ?? []).map((a) => a.handle);

  const cutoff = new Date(Date.now() - PERIOD_DAYS * 86400000).toISOString();

  const { data: videos, error: vidErr } =
    handles.length === 0
      ? { data: [] as VideoRow[], error: null }
      : await supabaseAdmin
          .from("videos")
          .select("handle, engagement_rate, published_at, views")
          .in("handle", handles)
          .or("is_contest.eq.false,contest_approved.eq.true")
          .gte("published_at", cutoff);
  if (vidErr) return NextResponse.json({ error: vidErr.message }, { status: 500 });

  const erByHandle = new Map<string, number[]>();
  const viewsByHandle = new Map<string, number>();
  const timestampsByHandle = new Map<string, number[]>();
  for (const v of videos ?? []) {
    if (v.engagement_rate != null) {
      const list = erByHandle.get(v.handle) ?? [];
      list.push(Number(v.engagement_rate));
      erByHandle.set(v.handle, list);
    }
    viewsByHandle.set(v.handle, (viewsByHandle.get(v.handle) ?? 0) + (v.views ?? 0));
    if (v.published_at) {
      const ts = timestampsByHandle.get(v.handle) ?? [];
      ts.push(new Date(v.published_at).getTime());
      timestampsByHandle.set(v.handle, ts);
    }
  }

  const entries = (accounts ?? []).map((acc) => {
    const ers = erByHandle.get(acc.handle) ?? [];
    const avg_er =
      ers.length > 0 ? ers.reduce((s, x) => s + x, 0) / ers.length : null;
    const total_views = viewsByHandle.get(acc.handle) ?? 0;
    const ts = timestampsByHandle.get(acc.handle) ?? [];
    const spanMs = ts.length >= 2 ? Math.max(...ts) - Math.min(...ts) : 0;
    const weeksSpan = Math.max(spanMs / (7 * 24 * 3600 * 1000), 1);
    const posts_per_week = ers.length > 0 ? ers.length / weeksSpan : null;
    return {
      handle: acc.handle,
      display_name: acc.display_name,
      avatar_url: acc.avatar_url,
      followers: acc.followers,
      tracked_since: acc.created_at,
      avg_er: avg_er != null ? parseFloat(avg_er.toFixed(4)) : null,
      video_count: ers.length,
      total_views,
      posts_per_week:
        posts_per_week != null ? parseFloat(posts_per_week.toFixed(2)) : null,
    };
  });

  entries.sort((a, b) => (b.avg_er ?? -1) - (a.avg_er ?? -1));

  const qualifyingEr = entries
    .filter((e) => e.avg_er != null && e.video_count >= 3)
    .map((e) => e.avg_er as number);
  const cat_avg_er =
    qualifyingEr.length > 0
      ? qualifyingEr.reduce((s, x) => s + x, 0) / qualifyingEr.length
      : null;

  const res = NextResponse.json({
    category,
    slug,
    account_count: entries.length,
    avg_er: cat_avg_er != null ? parseFloat(cat_avg_er.toFixed(4)) : null,
    period_days: PERIOD_DAYS,
    entries,
  });
  res.headers.set("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  return res;
}
