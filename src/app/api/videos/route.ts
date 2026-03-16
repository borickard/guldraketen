import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextRequest, NextResponse } from "next/server";

// Parse "2026-W10" → { start, end } as UTC Date bounds
function weekBounds(weekStr: string): { start: Date; end: Date } {
  const [yearStr, weekStr2] = weekStr.split("-W");
  const year = parseInt(yearStr);
  const week = parseInt(weekStr2);

  // ISO week 1 = week containing Jan 4
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
  const weekParam = req.nextUrl.searchParams.get("week");

  let startISO: string;
  let endISO: string;

  if (weekParam && /^\d{4}-W\d{2}$/.test(weekParam)) {
    const { start, end } = weekBounds(weekParam);
    startISO = start.toISOString();
    endISO = end.toISOString();
  } else {
    // Fallback: current week
    const now = new Date();
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
    monday.setUTCHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 7);
    startISO = monday.toISOString();
    endISO = sunday.toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from("videos")
    .select(`
      id,
      handle,
      video_url,
      published_at,
      views,
      likes,
      comments,
      shares,
      engagement_rate,
      thumbnail_url,
      caption,
      last_updated,
      accounts (
        followers
      )
    `)
    .gte("published_at", startISO)
    .lt("published_at", endISO)
    .gte("views", 5000)
    .order("engagement_rate", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}