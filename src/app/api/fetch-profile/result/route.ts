import { NextRequest, NextResponse } from "next/server";

const APIFY_API_BASE = "https://api.apify.com/v2";
const ACTOR_ID = "clockworks~tiktok-profile-scraper";

function firstNum(...vals: unknown[]): number {
  for (const v of vals) {
    const n = Number(v);
    if (!isNaN(n) && isFinite(n)) return n;
  }
  return 0;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("runId");

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
      const er = views > 0 ? ((likes + comments * 5 + shares * 10) / views) * 100 : 0;
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
        engagementRate: parseFloat(er.toFixed(4)),
        caption: ((item.text ?? item.description ?? "") as string).slice(0, 120),
        thumbnailUrl: (vm?.coverUrl as string | null) ?? (item.cover as string | null) ?? null,
      };
    })
    .filter((v) => v.views >= 1000 && v.videoUrl)
    .sort((a, b) => b.engagementRate - a.engagementRate);

  return NextResponse.json({ status: "ready", videos });
}
