import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const APIFY_ACTOR_ID = "clockworks~tiktok-profile-scraper";
const APIFY_API_BASE = "https://api.apify.com/v2";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { videoId, handle } = body ?? {};

  if (!videoId || !handle) {
    return NextResponse.json({ error: "videoId och handle krävs" }, { status: 400 });
  }

  // 1. DB lookup first
  const { data: dbVideo } = await supabaseAdmin
    .from("videos")
    .select("views,likes,comments,shares")
    .ilike("video_url", `%${videoId}%`)
    .maybeSingle();

  if (dbVideo) {
    const er = (dbVideo.views ?? 0) > 0
      ? ((dbVideo.likes + dbVideo.comments * 5 + dbVideo.shares * 10) / dbVideo.views) * 100
      : null;
    await supabaseAdmin.from("calculator_tests").insert({
      video_url: `https://www.tiktok.com/@${handle}/video/${videoId}`,
      video_id: videoId,
      handle,
      views: dbVideo.views,
      likes: dbVideo.likes,
      comments: dbVideo.comments,
      shares: dbVideo.shares,
      engagement_rate: er ? parseFloat(er.toFixed(4)) : null,
    });
    return NextResponse.json({
      source: "db",
      views: dbVideo.views,
      likes: dbVideo.likes,
      comments: dbVideo.comments,
      shares: dbVideo.shares,
    });
  }

  // 2. Not in DB — start async Apify run
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    return NextResponse.json({ error: "APIFY_TOKEN saknas" }, { status: 500 });
  }

  const res = await fetch(
    `${APIFY_API_BASE}/acts/${encodeURIComponent(APIFY_ACTOR_ID)}/runs?token=${apifyToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profiles: [`@${handle}`],
        profileScrapeSections: ["videos"],
        resultsPerPage: 20,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Apify start error ${res.status}: ${text}` }, { status: 502 });
  }

  const json = await res.json();
  const runId: string = json?.data?.id;

  if (!runId) {
    return NextResponse.json({ error: "Inget runId från Apify" }, { status: 502 });
  }

  return NextResponse.json({ source: "apify", runId });
}
