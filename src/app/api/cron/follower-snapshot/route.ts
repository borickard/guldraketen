import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseApifyItems, type VideoRow } from "@/lib/scrape";
import { uploadThumbnailsBatch, isStoredThumbnail } from "@/lib/thumbnails";

// Daily dashboard refresh for dashboard-linked handles only.
// Scrapes the last DAYS_BACK days of videos so we capture post-boost numbers
// (TikTok ads typically run ~7 days; we wait a few extra days for results to
// stabilize). Writes to its own `dashboard_videos` table so it never affects
// the public ranking that lives in `videos`.
//
// Side effects: also captures the latest follower count into `follower_history`
// and updates `accounts.followers` — replaces what the old follower-only
// snapshot did.

export const maxDuration = 300;

const APIFY_ACTOR_ID = "clockworks~tiktok-profile-scraper";
const APIFY_API_BASE = "https://api.apify.com/v2";
const POLL_INTERVAL_MS = 3_000;
const MAX_WAIT_MS = 240_000;

const DAYS_BACK = 10;
const RESULTS_PER_PROFILE = 50;

export async function GET(req: NextRequest) {
  return runSnapshot(req);
}

export async function POST(req: NextRequest) {
  return runSnapshot(req);
}

async function runSnapshot(req: NextRequest) {
  // No auth — matches the existing pattern for /api/scrape/trigger.
  // Vercel cron still uses the GET path; admin button triggers via POST.
  const ua = req.headers.get("user-agent") ?? "";
  const triggeredBy = /vercel-cron/i.test(ua) ? "cron-dashboard" : "manual-dashboard";

  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    return NextResponse.json({ error: "APIFY_TOKEN saknas" }, { status: 500 });
  }

  // 1. Collect distinct handles linked to dashboard users.
  const { data: linkedRows, error: linkErr } = await supabaseAdmin
    .from("user_handles")
    .select("handle");
  if (linkErr) {
    return NextResponse.json({ error: linkErr.message }, { status: 500 });
  }
  const handles = Array.from(new Set((linkedRows ?? []).map((r) => r.handle).filter(Boolean)));
  if (handles.length === 0) {
    return NextResponse.json({ ok: true, handles: 0, message: "No dashboard handles linked." });
  }

  // Log run start in scrape_runs so it shows up in the admin scrape-log.
  const { data: runRow } = await supabaseAdmin
    .from("scrape_runs")
    .insert({
      triggered_by: triggeredBy,
      days_back: DAYS_BACK,
      handles: handles.length,
      status: "started",
    })
    .select("id")
    .single();
  const scrapeRunId: string = runRow?.id ?? "";

  async function markFailed(error: string) {
    if (!scrapeRunId) return;
    await supabaseAdmin
      .from("scrape_runs")
      .update({
        status: "failed",
        error,
        completed_at: new Date().toISOString(),
      })
      .eq("id", scrapeRunId);
  }

  // 2. Kick off Apify run — pull DAYS_BACK days of videos per profile.
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - DAYS_BACK);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const runRes = await fetch(
    `${APIFY_API_BASE}/acts/${encodeURIComponent(APIFY_ACTOR_ID)}/runs`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apifyToken}` },
      body: JSON.stringify({
        profiles: handles,
        profileScrapeSections: ["videos"],
        profileSorting: "latest",
        resultsPerPage: RESULTS_PER_PROFILE,
        excludePinnedPosts: true,
        oldestPostDateUnified: cutoffStr,
      }),
    }
  );
  if (!runRes.ok) {
    await markFailed(`Apify start ${runRes.status}`);
    return NextResponse.json({ error: `Apify start ${runRes.status}` }, { status: 502 });
  }
  const runJson = await runRes.json();
  const runId: string = runJson?.data?.id;
  if (!runId) {
    await markFailed("Inget runId från Apify");
    return NextResponse.json({ error: "Inget runId från Apify" }, { status: 502 });
  }

  // Store Apify run ID on the scrape_runs row
  if (scrapeRunId) {
    await supabaseAdmin.from("scrape_runs").update({ run_id: runId }).eq("id", scrapeRunId);
  }

  // 3. Poll until SUCCEEDED.
  const deadline = Date.now() + MAX_WAIT_MS;
  let datasetId: string | null = null;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    let s: Response;
    try {
      s = await fetch(`${APIFY_API_BASE}/actor-runs/${runId}`, {
        headers: { Authorization: `Bearer ${apifyToken}` },
      });
    } catch {
      continue;
    }
    if (!s.ok) continue;
    const sJson = await s.json();
    const status: string = sJson?.data?.status ?? "";
    if (status === "SUCCEEDED") {
      datasetId = sJson?.data?.defaultDatasetId ?? null;
      break;
    }
    if (["FAILED", "TIMED_OUT", "TIMED-OUT", "ABORTED"].includes(status)) {
      await markFailed(`Apify status ${status}`);
      return NextResponse.json({ error: `Apify status ${status}` }, { status: 502 });
    }
  }
  if (!datasetId) {
    await markFailed("Apify-körningen tog för lång tid");
    return NextResponse.json({ error: "Apify-körningen tog för lång tid" }, { status: 504 });
  }

  // 4. Read dataset items.
  const dataRes = await fetch(
    `${APIFY_API_BASE}/datasets/${datasetId}/items?format=json&clean=true`,
    { headers: { Authorization: `Bearer ${apifyToken}` } }
  );
  if (!dataRes.ok) {
    await markFailed("Kunde inte läsa dataset");
    return NextResponse.json({ error: "Kunde inte läsa dataset" }, { status: 502 });
  }
  const items = await dataRes.json();
  const { videoRows, followerMap, skipped: parseSkipped } = parseApifyItems(items);

  // 5. Upsert videos into dashboard_videos. Strip the contest fields from
  // VideoRow — dashboard_videos doesn't track contest flags (those are a
  // public-ranking concern).
  const dashRows = videoRows.map((v) => ({
    handle: v.handle,
    video_url: v.video_url,
    published_at: v.published_at,
    views: v.views,
    likes: v.likes,
    comments: v.comments,
    shares: v.shares,
    collect_count: v.collect_count,
    thumbnail_url: v.thumbnail_url,
    caption: v.caption,
    is_ad: v.is_ad,
    is_sponsored: v.is_sponsored,
    last_updated: v.last_updated,
  }));
  const BATCH = 100;
  let upserted = 0;
  for (let i = 0; i < dashRows.length; i += BATCH) {
    const batch = dashRows.slice(i, i + BATCH);
    const { error } = await supabaseAdmin
      .from("dashboard_videos")
      .upsert(batch, { onConflict: "video_url" });
    if (error) {
      await markFailed(`Upsert dashboard_videos: ${error.message}`);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    upserted += batch.length;
  }

  // 6. Update follower counts (accounts.followers + follower_history).
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const historyRows = Object.entries(followerMap).map(([handle, followers]) => ({
    handle,
    captured_date: today,
    followers,
  }));
  if (historyRows.length > 0) {
    const { error: upErr } = await supabaseAdmin
      .from("follower_history")
      .upsert(historyRows, { onConflict: "handle,captured_date" });
    if (upErr) console.error("follower_history upsert error:", upErr.message);
    for (const [handle, followers] of Object.entries(followerMap)) {
      await supabaseAdmin
        .from("accounts")
        .update({ followers, followers_updated_at: now })
        .eq("handle", handle);
    }
  }

  // 7. Mark run completed before slow thumbnail uploads so data is safe.
  if (scrapeRunId) {
    await supabaseAdmin
      .from("scrape_runs")
      .update({
        status: "completed",
        upserted,
        skipped: parseSkipped,
        followers: historyRows.length,
        completed_at: new Date().toISOString(),
      })
      .eq("id", scrapeRunId);
  }

  // 8. Best-effort thumbnail upload to Supabase Storage. Failures are non-fatal
  // — videos and run record are already saved.
  try {
    const fullRows: VideoRow[] = videoRows;
    await uploadThumbnailsBatch(fullRows);
    const stored = fullRows.filter((r) => r.thumbnail_url && isStoredThumbnail(r.thumbnail_url));
    for (let i = 0; i < stored.length; i += BATCH) {
      const batchRows = stored.slice(i, i + BATCH);
      await Promise.all(
        batchRows.map((row) =>
          supabaseAdmin
            .from("dashboard_videos")
            .update({ thumbnail_url: row.thumbnail_url })
            .eq("video_url", row.video_url)
        )
      );
    }
  } catch {
    // ignore — thumbnails are best-effort
  }

  return NextResponse.json({
    ok: true,
    handles: handles.length,
    videos_upserted: upserted,
    followers_captured: historyRows.length,
    skipped: parseSkipped,
  });
}
