import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseApifyItems, type VideoRow } from "@/lib/scrape";
import { isStoredThumbnail, uploadThumbnailsBatch } from "@/lib/thumbnails";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/adminAuth";

// Admin-only deep dashboard scrape. Unlike the daily cron (last ~10 days), this
// pulls the full back-catalogue from Apify — which carries the real is_ad /
// is_sponsored flags TikTok exposes — and OVERWRITES the matching
// dashboard_videos rows (onConflict video_url, no ignoreDuplicates). That's how
// videos seeded from the public `videos` table (is_ad null) get their real boost
// flag set. Pass { handles: [...] } to target specific accounts (e.g. lyko),
// or omit to refresh every dashboard-linked handle.

export const maxDuration = 300;

const APIFY_ACTOR_ID = "clockworks~tiktok-profile-scraper";
const APIFY_API_BASE = "https://api.apify.com/v2";
const POLL_INTERVAL_MS = 3_000;
const MAX_WAIT_MS = 260_000;

const DAYS_BACK = 730; // ~2 years back to cover full history
const RESULTS_PER_PROFILE = 500;

export async function POST(req: NextRequest) {
  const started = Date.now();
  const adminToken = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const isAdmin = adminToken ? await verifyAdminSession(adminToken) : false;
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) return NextResponse.json({ error: "APIFY_TOKEN saknas" }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  let handles: string[] = Array.isArray(body.handles)
    ? body.handles.map((h: unknown) => String(h).trim().toLowerCase()).filter(Boolean)
    : [];

  if (handles.length === 0) {
    const { data: linkedRows, error } = await supabaseAdmin.from("user_handles").select("handle");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    handles = Array.from(new Set((linkedRows ?? []).map((r) => r.handle).filter(Boolean)));
  }
  if (handles.length === 0) {
    return NextResponse.json({ ok: true, handles: 0, message: "Inga handles att uppdatera." });
  }

  // Start Apify run (deep window).
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
    return NextResponse.json({ error: `Apify start ${runRes.status}` }, { status: 502 });
  }
  const runId: string = (await runRes.json())?.data?.id;
  if (!runId) return NextResponse.json({ error: "Inget runId från Apify" }, { status: 502 });

  // Poll until SUCCEEDED.
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
      return NextResponse.json({ error: `Apify status ${status}` }, { status: 502 });
    }
  }
  if (!datasetId) {
    return NextResponse.json({ error: "Apify-körningen tog för lång tid" }, { status: 504 });
  }

  // Read + parse dataset.
  const dataRes = await fetch(
    `${APIFY_API_BASE}/datasets/${datasetId}/items?format=json&clean=true`,
    { headers: { Authorization: `Bearer ${apifyToken}` } }
  );
  if (!dataRes.ok) return NextResponse.json({ error: "Kunde inte läsa dataset" }, { status: 502 });
  const items = await dataRes.json();
  const { videoRows, skipped } = parseApifyItems(items);

  // Overwrite dashboard_videos so real is_ad / is_sponsored replace any nulls.
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
  let withIsAd = 0;
  for (const r of dashRows) if (r.is_ad !== null) withIsAd++;
  for (let i = 0; i < dashRows.length; i += BATCH) {
    const batch = dashRows.slice(i, i + BATCH);
    const { error } = await supabaseAdmin
      .from("dashboard_videos")
      .upsert(batch, { onConflict: "video_url" });
    if (error) return NextResponse.json({ error: error.message, upserted }, { status: 500 });
    upserted += batch.length;
  }

  // Fix dashboard thumbnails so they use permanent Supabase Storage URLs rather
  // than the raw (expiring) TikTok cover URLs the scrape produced.
  const thumbs = await repairThumbnails(handles, videoRows, BATCH, started);

  return NextResponse.json({
    ok: true,
    handles,
    scraped: dashRows.length,
    upserted,
    with_is_ad: withIsAd,
    thumbs_from_public: thumbs.fromPublic,
    thumbs_uploaded: thumbs.uploaded,
    thumbs_remaining: thumbs.remaining,
    skipped,
  });
}

// Give dashboard_videos permanent Storage thumbnail URLs. Two sources:
//   1. Videos that also live in public `videos` already have a Storage URL —
//      copy it across (fast, no upload).
//   2. Dashboard-only videos (older history the public pipeline never scraped)
//      have no Storage URL anywhere, so upload their fresh cover URL — valid
//      right now because it came from THIS scrape — to Storage.
// Bounded by a time budget so it never trips Vercel's 300s limit; anything left
// over is reported as `remaining` and is picked up on a re-run (already-stored
// dashboard rows are skipped, so re-runs resume rather than repeat).
async function repairThumbnails(
  handles: string[],
  videoRows: VideoRow[],
  BATCH: number,
  started: number
): Promise<{ fromPublic: number; uploaded: number; remaining: number }> {
  const DEADLINE_MS = 265_000; // leave margin under maxDuration (300s)
  const UPLOAD_CHUNK = 25;
  let fromPublic = 0;
  let uploaded = 0;
  let remaining = 0;

  for (const handle of handles) {
    const handleRows = videoRows.filter((v) => v.handle === handle);

    // Permanent Storage URLs already known from the public `videos` table.
    const { data: pub } = await supabaseAdmin
      .from("videos")
      .select("video_url, thumbnail_url")
      .eq("handle", handle);
    const storageByUrl = new Map<string, string>();
    for (const v of pub ?? []) {
      if (v.thumbnail_url && isStoredThumbnail(v.thumbnail_url)) storageByUrl.set(v.video_url, v.thumbnail_url);
    }

    // Dashboard rows already carrying a Storage URL — skip so re-runs resume.
    const { data: dash } = await supabaseAdmin
      .from("dashboard_videos")
      .select("video_url, thumbnail_url")
      .eq("handle", handle);
    const dashDone = new Set<string>();
    for (const d of dash ?? []) {
      if (d.thumbnail_url && isStoredThumbnail(d.thumbnail_url)) dashDone.add(d.video_url);
    }

    // 1. Copy from public Storage.
    const fromPub = handleRows
      .filter((v) => storageByUrl.has(v.video_url))
      .map((v) => ({ video_url: v.video_url, thumbnail_url: storageByUrl.get(v.video_url)! }));
    for (let i = 0; i < fromPub.length; i += BATCH) {
      const batch = fromPub.slice(i, i + BATCH);
      await Promise.all(
        batch.map((u) =>
          supabaseAdmin.from("dashboard_videos").update({ thumbnail_url: u.thumbnail_url }).eq("video_url", u.video_url)
        )
      );
      fromPublic += batch.length;
    }

    // 2. Upload the dashboard-only ones from this scrape's fresh cover URLs.
    const rest = handleRows.filter(
      (v) =>
        !storageByUrl.has(v.video_url) &&
        !dashDone.has(v.video_url) &&
        v.thumbnail_url &&
        !isStoredThumbnail(v.thumbnail_url)
    );
    for (let i = 0; i < rest.length; i += UPLOAD_CHUNK) {
      if (Date.now() - started > DEADLINE_MS) {
        remaining += rest.length - i;
        break;
      }
      const chunk = rest.slice(i, i + UPLOAD_CHUNK);
      await uploadThumbnailsBatch(chunk); // mutates thumbnail_url in place on success
      const done = chunk.filter((v) => v.thumbnail_url && isStoredThumbnail(v.thumbnail_url));
      await Promise.all(
        done.map((v) =>
          supabaseAdmin.from("dashboard_videos").update({ thumbnail_url: v.thumbnail_url }).eq("video_url", v.video_url)
        )
      );
      uploaded += done.length;
    }
  }

  return { fromPublic, uploaded, remaining };
}
