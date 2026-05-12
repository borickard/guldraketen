import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calculateEngagement } from "@/lib/engagement";

const APIFY_ACTOR_ID = "clockworks~tiktok-video-scraper";
const APIFY_API_BASE = "https://api.apify.com/v2";

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const PENDING_TTL_MS = 5 * 60 * 1000; // resume an in-flight Apify run if started within 5 min

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { videoId, handle } = body ?? {};

  if (!videoId || !handle) {
    return NextResponse.json({ error: "videoId och handle krävs" }, { status: 400 });
  }

  // 1. Check videos table (weekly scrape data)
  const { data: dbVideo } = await supabaseAdmin
    .from("videos")
    .select("views,likes,comments,shares,collect_count,last_updated")
    .ilike("video_url", `%${videoId}%`)
    .maybeSingle();

  if (dbVideo) {
    const timeSinceScrape = Date.now() - new Date(dbVideo.last_updated).getTime();
    if (timeSinceScrape <= TWO_DAYS_MS) {
      const er = (dbVideo.views ?? 0) > 0
        ? calculateEngagement({
            views: dbVideo.views,
            likes: dbVideo.likes,
            comments: dbVideo.comments,
            shares: dbVideo.shares,
            collect_count: dbVideo.collect_count,
          })
        : null;
      await supabaseAdmin.from("calculator_tests").insert({
        video_url: `https://www.tiktok.com/@${handle}/video/${videoId}`,
        video_id: videoId,
        handle,
        views: dbVideo.views,
        likes: dbVideo.likes,
        comments: dbVideo.comments,
        shares: dbVideo.shares,
        collect_count: dbVideo.collect_count,
        engagement_rate: er ? parseFloat(er.toFixed(4)) : null,
        source: "db",
      });
      return NextResponse.json({
        source: "db",
        views: dbVideo.views,
        likes: dbVideo.likes,
        comments: dbVideo.comments,
        shares: dbVideo.shares,
        collect_count: dbVideo.collect_count,
        lastUpdated: dbVideo.last_updated,
      });
    }
  }

  // 2. Check profile_scans — if this handle was recently scanned as a profile,
  //    find the matching video in the stored JSONB array (no Apify round-trip needed)
  if (handle) {
    const { data: profileScan } = await supabaseAdmin
      .from("profile_scans")
      .select("videos, scanned_at")
      .eq("handle", handle)
      .order("scanned_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (profileScan?.videos) {
      const age = Date.now() - new Date(profileScan.scanned_at).getTime();
      if (age <= TWO_DAYS_MS) {
        type CachedVideo = { videoId: string | null; videoUrl: string; views: number; likes: number; comments: number; shares: number; collectCount?: number | null; engagementRate: number };
        const match = (profileScan.videos as CachedVideo[]).find(
          (v) => v.videoId === videoId || v.videoUrl?.includes(videoId)
        );
        if (match) {
          const matchCollect = match.collectCount ?? null;
          await supabaseAdmin.from("calculator_tests").insert({
            video_url: `https://www.tiktok.com/@${handle}/video/${videoId}`,
            video_id: videoId,
            handle,
            views: match.views,
            likes: match.likes,
            comments: match.comments,
            shares: match.shares,
            collect_count: matchCollect,
            engagement_rate: parseFloat(match.engagementRate.toFixed(4)),
            source: "db",
          });
          return NextResponse.json({
            source: "db",
            views: match.views,
            likes: match.likes,
            comments: match.comments,
            shares: match.shares,
            collect_count: matchCollect,
            lastUpdated: profileScan.scanned_at,
          });
        }
      }
    }
  }

  // 3. Check calculator_tests for a recent completed result. Pending rows
  //    are skipped here — they're handled in step 4 below.
  const { data: cachedTest } = await supabaseAdmin
    .from("calculator_tests")
    .select("views,likes,comments,shares,collect_count,engagement_rate,tested_at")
    .ilike("video_url", `%${videoId}%`)
    .in("source", ["db", "apify"])
    .order("tested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cachedTest) {
    const timeSinceTest = Date.now() - new Date(cachedTest.tested_at).getTime();
    if (timeSinceTest <= TWO_DAYS_MS) {
      await supabaseAdmin.from("calculator_tests").insert({
        video_url: `https://www.tiktok.com/@${handle}/video/${videoId}`,
        video_id: videoId,
        handle,
        views: cachedTest.views,
        likes: cachedTest.likes,
        comments: cachedTest.comments,
        shares: cachedTest.shares,
        collect_count: cachedTest.collect_count,
        engagement_rate: cachedTest.engagement_rate,
        source: "db",
      });
      return NextResponse.json({
        source: "db",
        views: cachedTest.views,
        likes: cachedTest.likes,
        comments: cachedTest.comments,
        shares: cachedTest.shares,
        collect_count: cachedTest.collect_count,
        lastUpdated: cachedTest.tested_at,
      });
    }
  }

  // 4. Resume an in-flight Apify run if one was started recently for this
  //    same video. Without this, refreshing the kalkylator page while Apify
  //    is still running spawns a new Apify run on every refresh — the
  //    completion handler only writes to calculator_tests when the client
  //    polls /result through to SUCCEEDED.
  const pendingCutoff = new Date(Date.now() - PENDING_TTL_MS).toISOString();
  const { data: pendingRun } = await supabaseAdmin
    .from("calculator_tests")
    .select("run_id, tested_at")
    .eq("video_id", videoId)
    .eq("source", "pending")
    .not("run_id", "is", null)
    .gte("tested_at", pendingCutoff)
    .order("tested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingRun?.run_id) {
    return NextResponse.json({ source: "apify", runId: pendingRun.run_id });
  }

  // 5. Not in cache — check daily Apify call limit before starting a run.
  //    Pending rows also count, so we don't keep spawning runs even if
  //    completions never get written.
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);

  let dailyLimit = 100;
  try {
    const { data: limitSetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "calc_daily_limit")
      .maybeSingle();
    if (limitSetting?.value) {
      dailyLimit = parseInt(limitSetting.value, 10) || 100;
    }
  } catch {
    // Fall back to default if table doesn't exist yet
  }

  const { count: todayCount } = await supabaseAdmin
    .from("calculator_tests")
    .select("id", { count: "exact", head: true })
    .in("source", ["apify", "pending"])
    .gte("tested_at", todayUTC.toISOString());

  if ((todayCount ?? 0) >= dailyLimit) {
    return NextResponse.json({ error: "daily_limit" }, { status: 429 });
  }

  // 6. Start async Apify run
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    return NextResponse.json({ error: "APIFY_TOKEN saknas" }, { status: 500 });
  }

  const apifyBody = JSON.stringify({
    postURLs: [`https://www.tiktok.com/@${handle}/video/${videoId}`],
  });

  let apifyRes: Response;
  try {
    apifyRes = await fetch(
      `${APIFY_API_BASE}/acts/${encodeURIComponent(APIFY_ACTOR_ID)}/runs`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apifyToken}`,
        },
        body: apifyBody,
      }
    );
  } catch (err) {
    return NextResponse.json({ error: `Nätverksfel mot Apify: ${err}` }, { status: 502 });
  }

  if (!apifyRes.ok) {
    const text = await apifyRes.text();
    if (apifyRes.status === 403 && text.includes("hard limit exceeded")) {
      return NextResponse.json(
        { error: "Kalkylatorn är tillfälligt pausad. Prova igen om några dagar." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: `Apify start error ${apifyRes.status}: ${text}` }, { status: 502 });
  }

  const json = await apifyRes.json();
  const runId: string = json?.data?.id;

  if (!runId) {
    return NextResponse.json({ error: "Inget runId från Apify" }, { status: 502 });
  }

  // Record a pending row so refreshes resume this run instead of spawning
  // a new one. /result will UPDATE this row when Apify finishes.
  await supabaseAdmin.from("calculator_tests").insert({
    video_url: `https://www.tiktok.com/@${handle}/video/${videoId}`,
    video_id: videoId,
    handle,
    run_id: runId,
    source: "pending",
  });

  return NextResponse.json({ source: "apify", runId });
}
