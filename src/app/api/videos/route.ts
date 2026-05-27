import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextRequest, NextResponse } from "next/server";

function weekBounds(weekStr: string): { start: Date; end: Date } {
  const [yearStr, weekStr2] = weekStr.split("-W");
  const year = parseInt(yearStr);
  const week = parseInt(weekStr2);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
  const start = new Date(startOfWeek1);
  start.setUTCDate(startOfWeek1.getUTCDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return { start, end };
}

export async function GET(req: NextRequest) {
  const week = req.nextUrl.searchParams.get("week");
  const boost = req.nextUrl.searchParams.get("boost") ?? "all";

  if (!week || !/^\d{4}-W\d{2}$/.test(week)) {
    return NextResponse.json(
      { error: "Ogiltig eller saknad week-parameter" },
      { status: 400 }
    );
  }

  const { start, end } = weekBounds(week);

  const fields = "id, handle, video_url, published_at, views, likes, comments, shares, collect_count, is_ad, engagement_rate, thumbnail_url, caption, last_updated, accounts ( followers, display_name, category )";

  let query = supabaseAdmin
    .from("videos")
    .select(fields)
    .gte("published_at", start.toISOString())
    .lt("published_at", end.toISOString())
    .or("is_contest.eq.false,contest_approved.eq.true")
    .order("engagement_rate", { ascending: false })
    .limit(200);

  if (boost === "organic") query = query.eq("is_ad", false);
  else if (boost === "boosted") query = query.eq("is_ad", true);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const res = NextResponse.json(data);
  res.headers.set("Cache-Control", "s-maxage=1800, stale-while-revalidate=7200");
  return res;
}
