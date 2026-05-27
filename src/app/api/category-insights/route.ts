import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { slugifyCategory } from "@/lib/categories";
import { getVisibleCategoryNames } from "@/lib/categoryVisibility";

const PERIOD_DAYS = 90;
const MIN_VIDEOS_FOR_AVG = 3;

interface AccountRow {
  handle: string;
  display_name: string | null;
  category: string | null;
}

interface VideoRow {
  handle: string;
  engagement_rate: number | null;
}

interface AccountSummary {
  handle: string;
  display_name: string | null;
  avg_er: number | null;
  video_count: number;
}

export async function GET() {
  const cutoff = new Date(Date.now() - PERIOD_DAYS * 86400000).toISOString();

  const { data: accounts, error: accErr } = await supabaseAdmin
    .from("accounts")
    .select("handle, display_name, category")
    .eq("is_active", true)
    .not("category", "is", null);
  if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 });

  const trackedHandles = (accounts ?? []).map((a) => a.handle);

  const { data: videos, error: vidErr } =
    trackedHandles.length === 0
      ? { data: [] as VideoRow[], error: null }
      : await supabaseAdmin
          .from("videos")
          .select("handle, engagement_rate")
          .in("handle", trackedHandles)
          .or("is_contest.eq.false,contest_approved.eq.true")
          .gte("published_at", cutoff);
  if (vidErr) return NextResponse.json({ error: vidErr.message }, { status: 500 });

  const erByHandle = new Map<string, number[]>();
  for (const v of videos ?? []) {
    if (v.engagement_rate == null) continue;
    const list = erByHandle.get(v.handle) ?? [];
    list.push(Number(v.engagement_rate));
    erByHandle.set(v.handle, list);
  }

  const accountSummaries = new Map<string, AccountSummary>();
  for (const acc of (accounts ?? []) as AccountRow[]) {
    const ers = erByHandle.get(acc.handle) ?? [];
    const avg_er = ers.length > 0 ? ers.reduce((s, x) => s + x, 0) / ers.length : null;
    accountSummaries.set(acc.handle, {
      handle: acc.handle,
      display_name: acc.display_name,
      avg_er,
      video_count: ers.length,
    });
  }

  const byCategory = new Map<string, AccountSummary[]>();
  for (const acc of (accounts ?? []) as AccountRow[]) {
    if (!acc.category) continue;
    const summary = accountSummaries.get(acc.handle);
    if (!summary) continue;
    const list = byCategory.get(acc.category) ?? [];
    list.push(summary);
    byCategory.set(acc.category, list);
  }

  const visible = await getVisibleCategoryNames();
  const result = visible.map((cat) => {
    const summaries = byCategory.get(cat) ?? [];
    const qualifying = summaries.filter(
      (s) => s.avg_er != null && s.video_count >= MIN_VIDEOS_FOR_AVG
    );
    const avg_er =
      qualifying.length > 0
        ? qualifying.reduce((s, x) => s + (x.avg_er ?? 0), 0) / qualifying.length
        : null;
    const top = qualifying
      .slice()
      .sort((a, b) => (b.avg_er ?? 0) - (a.avg_er ?? 0))[0];
    return {
      category: cat,
      slug: slugifyCategory(cat),
      account_count: summaries.length,
      avg_er: avg_er != null ? parseFloat(avg_er.toFixed(4)) : null,
      top_account: top
        ? {
            handle: top.handle,
            display_name: top.display_name,
            avg_er: top.avg_er != null ? parseFloat(top.avg_er.toFixed(4)) : null,
          }
        : null,
    };
  });

  const res = NextResponse.json(result);
  res.headers.set("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  return res;
}
