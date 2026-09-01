import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isStoredThumbnail } from "@/lib/thumbnails";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/adminAuth";

// Admin-only repair for broken dashboard thumbnails. Some dashboard_videos rows
// were written with raw TikTok CDN thumbnail URLs (from the deep dashboard
// refresh / scrape sync) which expire and 404. The public `videos` table already
// holds permanent Supabase Storage URLs for the same videos — this copies those
// onto the matching dashboard_videos rows. Fast, no Apify, no re-upload.
//
// Only repairs rows where the dashboard thumbnail isn't already a Storage URL,
// so it's cheap to re-run and idempotent. Pass { handles } to target specific
// accounts, or omit to repair every dashboard-linked handle.

export async function POST(req: NextRequest) {
  const adminToken = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const isAdmin = adminToken ? await verifyAdminSession(adminToken) : false;
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  let handles: string[] = Array.isArray(body.handles)
    ? body.handles.map((h: unknown) => String(h).trim().toLowerCase()).filter(Boolean)
    : [];

  if (handles.length === 0) {
    const { data: linkedRows, error } = await supabaseAdmin.from("user_handles").select("handle");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    handles = Array.from(new Set((linkedRows ?? []).map((r) => r.handle).filter(Boolean)));
  }

  const BATCH = 100;
  const results: { handle: string; broken: number; repaired: number }[] = [];

  for (const handle of handles) {
    // Storage URLs for this handle, keyed by video_url.
    const { data: pub } = await supabaseAdmin
      .from("videos")
      .select("video_url, thumbnail_url")
      .eq("handle", handle);
    const storageByUrl = new Map<string, string>();
    for (const v of pub ?? []) {
      if (v.thumbnail_url && isStoredThumbnail(v.thumbnail_url)) {
        storageByUrl.set(v.video_url, v.thumbnail_url);
      }
    }

    // Dashboard rows whose thumbnail is missing or a non-Storage (expiring) URL.
    const { data: dash } = await supabaseAdmin
      .from("dashboard_videos")
      .select("video_url, thumbnail_url")
      .eq("handle", handle);
    const needsFix = (dash ?? []).filter(
      (d) => !d.thumbnail_url || !isStoredThumbnail(d.thumbnail_url)
    );

    const updates = needsFix
      .map((d) => {
        const storage = storageByUrl.get(d.video_url);
        return storage ? { video_url: d.video_url, thumbnail_url: storage } : null;
      })
      .filter((u): u is { video_url: string; thumbnail_url: string } => u !== null);

    let repaired = 0;
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

    results.push({ handle, broken: needsFix.length, repaired });
  }

  return NextResponse.json({ ok: true, handles: handles.length, results });
}
