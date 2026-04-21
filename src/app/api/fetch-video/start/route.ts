import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const APIFY_ACTOR_ID = "clockworks~tiktok-video-scraper";
const APIFY_API_BASE = "https://api.apify.com/v2";

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { videoId, handle } = body ?? {};

  if (!videoId || !handle) {
    return NextResponse.json({ error: "videoId och handle krävs" }, { status: 400 });
  }

  // 1. Check videos table (weekly scrape data)
  const { data: dbVideo } = await supabaseAdmin
    .from("videos")
    .select("views,likes,comments,shares,last_updated")
    .ilike("video_url", `%${videoId}%`)
    .maybeSingle();

  if (dbVideo) {
    const timeSinceScrape = Date.now() - new Date(dbVideo.last_updated).getTime();
    if (timeSinceScrape <= TWO_DAYS_MS) {
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
        source: "db",
      });
      return NextResponse.json({
        source: "db",
        views: dbVideo.views,
        likes: dbVideo.likes,
        comments: dbVideo.comments,
        shares: dbVideo.shares,
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
        type CachedVideo = { videoId: string | null; videoUrl: string; views: number; likes: number; comments: number; shares: number; engagementRate: number };
        const match = (profileScan.videos as CachedVideo[]).find(
          (v) => v.videoId === videoId || v.videoUrl?.includes(videoId)
        );
        if (match) {
          await supabaseAdmin.from("calculator_tests").insert({
            video_url: `https://www.tiktok.com/@${handle}/video/${videoId}`,
            video_id: videoId,
            handle,
            views: match.views,
            likes: match.likes,
            comments: match.comments,
            shares: match.shares,
            engagement_rate: parseFloat(match.engagementRate.toFixed(4)),
            source: "db",
          });
          return NextResponse.json({
            source: "db",
            views: match.views,
            likes: match.likes,
            comments: match.comments,
            shares: match.shares,
            lastUpdated: profileScan.scanned_at,
          });
        }
      }
    }
  }

  // 3. Check calculator_tests for a recent result (videos tested via calculator
  //    are not in the videos table, so we need this as a second cache layer)
  const { data: cachedTest } = await supabaseAdmin
    .from("calculator_tests")
    .select("views,likes,comments,shares,engagement_rate,tested_at")
    .ilike("video_url", `%${videoId}%`)
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
        engagement_rate: cachedTest.engagement_rate,
        source: "db",
      });
      return NextResponse.json({
        source: "db",
        views: cachedTest.views,
        likes: cachedTest.likes,
        comments: cachedTest.comments,
        shares: cachedTest.shares,
        lastUpdated: cachedTest.tested_at,
      });
    }
  }

  // 4. Not in cache — check daily Apify call limit before starting a run
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);

  // Fetch configurable limit from app_settings (default: 100)
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
    .eq("source", "apify")
    .gte("tested_at", todayUTC.toISOString());

  if ((todayCount ?? 0) >= dailyLimit) {
    return NextResponse.json({ error: "daily_limit" }, { status: 429 });
  }

  // 5. Start async Apify run
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

  return NextResponse.json({ source: "apify", runId });
}
