import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const revalidate = 3600;

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("videos")
    .select("handle, video_url, thumbnail_url, engagement_rate, views, accounts(display_name, followers)")
    .not("thumbnail_url", "is", null)
    .gte("views", 10000)
    .or("is_contest.eq.false,contest_approved.eq.true")
    .order("engagement_rate", { ascending: false })
    .limit(60);

  if (error || !data) return NextResponse.json([]);

  // Deduplicate by handle — keep each account's best video
  const seen = new Set<string>();
  const deduped = data.filter((v) => {
    if (seen.has(v.handle)) return false;
    seen.add(v.handle);
    return true;
  }).slice(0, 20);

  return NextResponse.json(deduped, {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
  });
}
