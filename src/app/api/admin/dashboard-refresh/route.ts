import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseApifyItems } from "@/lib/scrape";
import { isStoredThumbnail } from "@/lib/thumbnails";
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

  // The scraped rows carry raw (expiring) TikTok thumbnail URLs. The public
  // `videos` table already has permanent Supabase Storage URLs for the same
  // videos, so re-point dashboard_videos to those instead of re-uploading.
  const thumbsRepaired = await repointThumbnailsFromPublic(handles, BATCH);

  return NextResponse.json({
    ok: true,
    handles,
    scraped: dashRows.length,
    upserted,
    with_is_ad: withIsAd,
    thumbs_repaired: thumbsRepaired,
    skipped,
  });
}

// Copy the permanent Storage thumbnail URLs from `videos` onto the matching
// dashboard_videos rows, replacing raw TikTok URLs that expire. Shared shape
// with /api/admin/repair-dashboard-thumbnails.
async function repointThumbnailsFromPublic(handles: string[], BATCH: number): Promise<number> {
  let repaired = 0;
  for (const handle of handles) {
    const { data: pub } = await supabaseAdmin
      .from("videos")
      .select("video_url, thumbnail_url")
      .eq("handle", handle);
    const updates = (pub ?? [])
      .filter((v) => v.thumbnail_url && isStoredThumbnail(v.thumbnail_url))
      .map((v) => ({ video_url: v.video_url, thumbnail_url: v.thumbnail_url as string }));
    for (let i = 0; i < updates.length; i += BATCH) {
      const batch = updates.slice(i, i + BATCH);
      await Promise.all(
        batch.map((u) =>
          supabaseAdmin
            .from("dashboard_videos")
            .update({ thumbnail_url: u.thumbnail_url })
            .eq("video_url", u.video_url)
        )
      );
      repaired += batch.length;
    }
  }
  return repaired;
}
