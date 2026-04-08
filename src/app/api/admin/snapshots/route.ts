import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextRequest, NextResponse } from "next/server";

const MIN_VIDEO_VIEWS = 10_000;

function weekBounds(weekStr: string): { start: Date; end: Date } {
  const [yearStr, wStr] = weekStr.split("-W");
  const year = parseInt(yearStr);
  const week = parseInt(wStr);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
  const start = new Date(startOfWeek1);
  start.setUTCDate(startOfWeek1.getUTCDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return { start, end };
}

// GET — list all locked weeks with their top entries
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("weekly_snapshots")
    .select("week, rank, handle, engagement_rate, views, locked_at")
    .order("week", { ascending: false })
    .order("rank", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by week
  const byWeek = new Map<string, typeof data>();
  for (const row of data ?? []) {
    const list = byWeek.get(row.week) ?? [];
    list.push(row);
    byWeek.set(row.week, list);
  }

  const result = [...byWeek.entries()].map(([week, rows]) => ({
    week,
    locked_at: rows[0]?.locked_at ?? null,
    count: rows.length,
    top3: rows.slice(0, 3),
  }));

  return NextResponse.json(result);
}

// POST — lock (snapshot) a specific week from live data
export async function POST(req: NextRequest) {
  const { week } = await req.json();
  if (!week || !/^\d{4}-W\d{2}$/.test(week)) {
    return NextResponse.json({ error: "Ogiltig veckosträng, t.ex. 2026-W14" }, { status: 400 });
  }

  const { start, end } = weekBounds(week);

  const { data: videos, error } = await supabaseAdmin
    .from("videos")
    .select("handle, video_url, views, likes, comments, shares, engagement_rate")
    .gte("published_at", start.toISOString())
    .lt("published_at", end.toISOString())
    .or("is_contest.eq.false,contest_approved.eq.true")
    .not("engagement_rate", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type VideoRow = { handle: string; video_url: string; views: number | null; likes: number | null; comments: number | null; shares: number | null; engagement_rate: number | null };
  // Best video per account (min views filter)
  const byAccount = new Map<string, VideoRow>();
  for (const v of videos ?? []) {
    if ((v.views ?? 0) < MIN_VIDEO_VIEWS) continue;
    const existing = byAccount.get(v.handle);
    if (!existing || (v.engagement_rate ?? 0) > (existing.engagement_rate ?? 0)) {
      byAccount.set(v.handle, v);
    }
  }

  if (byAccount.size === 0) {
    return NextResponse.json(
      { error: "Inga videor med tillräckliga visningar hittades för den veckan" },
      { status: 400 }
    );
  }

  const ranked = [...byAccount.entries()]
    .sort(([, a], [, b]) => (b.engagement_rate ?? 0) - (a.engagement_rate ?? 0))
    .map(([handle, v], i) => ({
      week,
      rank: i + 1,
      handle,
      video_url: v.video_url,
      views: v.views,
      likes: v.likes,
      comments: v.comments,
      shares: v.shares,
      engagement_rate: v.engagement_rate,
    }));

  // Replace existing snapshot for this week
  await supabaseAdmin.from("weekly_snapshots").delete().eq("week", week);
  const { error: insertError } = await supabaseAdmin
    .from("weekly_snapshots")
    .insert(ranked);

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ ok: true, count: ranked.length });
}

// DELETE — unlock a week (remove its snapshot)
export async function DELETE(req: NextRequest) {
  const { week } = await req.json();
  if (!week) return NextResponse.json({ error: "Saknar week" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("weekly_snapshots")
    .delete()
    .eq("week", week);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
