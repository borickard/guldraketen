import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calculateEngagement } from "@/lib/engagement";

const APIFY_API_BASE = "https://api.apify.com/v2";
const ACTOR_ID = "clockworks~tiktok-profile-scraper";

function firstNum(...vals: unknown[]): number {
  for (const v of vals) {
    const n = Number(v);
    if (!isNaN(n) && isFinite(n)) return n;
  }
  return 0;
}

// Returns null if no value was provided in any input — used for fields where
// "absent" must remain distinguishable from "zero" (collect_count).
function firstNumOrNull(...vals: unknown[]): number | null {
  for (const v of vals) {
    if (v === null || v === undefined || v === "") continue;
    const n = Number(v);
    if (!isNaN(n) && isFinite(n)) return n;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("runId");
  const handle = searchParams.get("handle");

  if (!runId) {
    return NextResponse.json({ error: "runId krävs" }, { status: 400 });
  }

  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    return NextResponse.json({ error: "APIFY_TOKEN saknas" }, { status: 500 });
  }

  const statusRes = await fetch(
    `${APIFY_API_BASE}/acts/${encodeURIComponent(ACTOR_ID)}/runs/${runId}?token=${apifyToken}`
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

  const datasetId: string = statusJson?.data?.defaultDatasetId;
  if (!datasetId) return NextResponse.json({ status: "error" });

  const dataRes = await fetch(
    `${APIFY_API_BASE}/datasets/${datasetId}/items?token=${apifyToken}&format=json&clean=true`
  );
  if (!dataRes.ok) return NextResponse.json({ status: "error" });

  const items = (await dataRes.json()) as Record<string, unknown>[];

  const videos = items
    .map((item) => {
      const stats = ((item.stats ?? item.statistics ?? {}) as Record<string, unknown>);
      const views = firstNum(stats.playCount, stats.viewCount, item.playCount, item.viewCount);
      const likes = firstNum(stats.diggCount, stats.likeCount, item.diggCount, item.likeCount);
      const comments = firstNum(stats.commentCount, item.commentCount);
      const shares = firstNum(stats.shareCount, item.shareCount);
      const collectCount = firstNumOrNull(
        stats.collectCount,
        stats.bookmarkCount,
        stats.collect_count,
        item.collectCount,
        item.bookmarkCount
      );
      const er = calculateEngagement({ views, likes, comments, shares, collect_count: collectCount });
      const videoUrl = ((item.webVideoUrl ?? item.videoUrl ?? item.url ?? "") as string);
      const videoIdMatch = videoUrl.match(/\/video\/(\d+)/);
      const vm = item.videoMeta as Record<string, unknown> | undefined;
      return {
        videoId: videoIdMatch?.[1] ?? null,
        videoUrl,
        views,
        likes,
        comments,
        shares,
        collectCount,
        engagementRate: parseFloat(er.toFixed(4)),
        caption: ((item.text ?? item.description ?? "") as string).slice(0, 120),
        thumbnailUrl: (vm?.coverUrl as string | null) ?? (item.cover as string | null) ?? null,
      };
    })
    .filter((v) => v.views >= 1000 && v.videoUrl)
    .sort((a, b) => b.engagementRate - a.engagementRate);

  if (handle && videos.length > 0) {
    await supabaseAdmin.from("profile_scans").insert({ handle, videos });
  }

  return NextResponse.json({ status: "ready", videos });
}
