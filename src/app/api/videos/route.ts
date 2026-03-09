import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

export async function GET() {
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
      last_updated,
      accounts (
        followers
      )
    `)
        .order("engagement_rate", { ascending: false })
        .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}