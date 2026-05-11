import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calculateEngagement } from "@/lib/engagement";

const APIFY_ACTOR_ID = "clockworks~tiktok-profile-scraper";
const APIFY_API_BASE = "https://api.apify.com/v2";

function firstNumber(...vals: (number | undefined | null)[]): number | null {
  for (const v of vals) {
    if (typeof v === "number" && !isNaN(v)) return v;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("runId");
  const videoId = searchParams.get("videoId");
  const handle = searchParams.get("handle");

  if (!runId || !videoId) {
    return NextResponse.json({ error: "runId och videoId krävs" }, { status: 400 });
  }

  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    return NextResponse.json({ error: "APIFY_TOKEN saknas" }, { status: 500 });
  }

  // 1. Check run status
  const statusRes = await fetch(
    `${APIFY_API_BASE}/acts/${encodeURIComponent(APIFY_ACTOR_ID)}/runs/${runId}?token=${apifyToken}`
  );

  if (!statusRes.ok) {
    return NextResponse.json({ status: "error" });
  }

  const statusJson = await statusRes.json();
  const runStatus: string = statusJson?.data?.status ?? "";

  if (["RUNNING", "READY", "CREATED"].includes(runStatus)) {
    return NextResponse.json({ status: "pending" });
  }

  if (["FAILED", "TIMED-OUT", "ABORTED"].includes(runStatus)) {
    return NextResponse.json({ status: "error" });
  }

  if (runStatus !== "SUCCEEDED") {
    return NextResponse.json({ status: "pending" });
  }

  // 2. Fetch dataset items
  const datasetId: string = statusJson?.data?.defaultDatasetId;
  if (!datasetId) {
    return NextResponse.json({ status: "error" });
  }

  const dataRes = await fetch(
    `${APIFY_API_BASE}/datasets/${datasetId}/items?token=${apifyToken}&format=json`
  );

  if (!dataRes.ok) {
    return NextResponse.json({ status: "error" });
  }

  const items: unknown[] = await dataRes.json();

  // 3. Find item matching videoId
  const item = (items as Record<string, unknown>[]).find((it) => {
    const url = (it.webVideoUrl ?? it.video_url ?? it.videoUrl ?? "") as string;
    return url.includes(videoId);
  });

  if (!item) {
    return NextResponse.json({ status: "not-found" });
  }

  const stats = (item.stats ?? {}) as Record<string, unknown>;

  const views = firstNumber(
    stats.playCount as number,
    stats.viewCount as number,
    item.playCount as number,
    item.viewCount as number
  );
  const likes = firstNumber(
    stats.diggCount as number,
    stats.likeCount as number,
    item.diggCount as number,
    item.likeCount as number
  );
  const comments = firstNumber(
    stats.commentCount as number,
    item.commentCount as number
  );
  const shares = firstNumber(
    stats.shareCount as number,
    item.shareCount as number
  );
  const collectCount = firstNumber(
    stats.collectCount as number,
    stats.bookmarkCount as number,
    stats.collect_count as number,
    item.collectCount as number,
    item.bookmarkCount as number
  );

  const er = (views ?? 0) > 0
    ? calculateEngagement({
        views: views ?? 0,
        likes: likes ?? 0,
        comments: comments ?? 0,
        shares: shares ?? 0,
        collect_count: collectCount,
      })
    : null;
  await supabaseAdmin.from("calculator_tests").insert({
    video_url: handle
      ? `https://www.tiktok.com/@${handle}/video/${videoId}`
      : `https://www.tiktok.com/video/${videoId}`,
    video_id: videoId,
    handle: handle || null,
    views,
    likes,
    comments,
    shares,
    collect_count: collectCount,
    engagement_rate: er ? parseFloat(er.toFixed(4)) : null,
    source: "apify",
  });

  return NextResponse.json({ status: "ready", views, likes, comments, shares, collect_count: collectCount });
}
