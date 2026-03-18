import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

export async function GET() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);

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
        followers,
        display_name
      )
    `)
    .gte("published_at", cutoff.toISOString())
    .gte("views", 5000)
    .order("engagement_rate", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}