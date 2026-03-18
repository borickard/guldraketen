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

  if (!week || !/^\d{4}-W\d{2}$/.test(week)) {
    return NextResponse.json(
      { error: "Ogiltig eller saknad week-parameter" },
      { status: 400 }
    );
  }

  const { start, end } = weekBounds(week);

  const fields = "id, handle, video_url, published_at, views, likes, comments, shares, engagement_rate, thumbnail_url, caption, last_updated, accounts ( followers, display_name )";

  const { data, error } = await supabaseAdmin
    .from("videos")
    .select(fields)
    .gte("published_at", start.toISOString())
    .lt("published_at", end.toISOString())
    .order("engagement_rate", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
