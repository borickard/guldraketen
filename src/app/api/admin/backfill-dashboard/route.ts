import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/adminAuth";

// Admin-only, fast, Apify-free backfill of dashboard_videos from the public
// `videos` table. The daily dashboard cron only scrapes the last ~10 days, so a
// dashboard-linked handle's older history never reaches dashboard_videos. This
// copies the full back-catalogue across for every linked handle and returns
// per-handle counts so the outcome is observable (no waiting on a scrape run).
//
// `videos` carries is_ad/is_sponsored, so those come across too. ignoreDuplicates
// keeps rows the daily scrape already wrote. engagement_rate is a generated
// column, so it recomputes.

export async function POST(req: NextRequest) {
  const adminToken = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const isAdmin = adminToken ? await verifyAdminSession(adminToken) : false;
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: linkedRows, error: linkErr } = await supabaseAdmin
    .from("user_handles")
    .select("handle");
  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });

  const handles = Array.from(
    new Set((linkedRows ?? []).map((r) => r.handle).filter(Boolean))
  );

  const results: {
    handle: string;
    dashboard_before: number;
    public_videos: number;
    inserted: number;
  }[] = [];

  for (const handle of handles) {
    const [{ count: dashCount }, { count: pubCount }] = await Promise.all([
      supabaseAdmin
        .from("dashboard_videos")
        .select("id", { count: "exact", head: true })
        .eq("handle", handle),
      supabaseAdmin
        .from("videos")
        .select("id", { count: "exact", head: true })
        .eq("handle", handle),
    ]);

    const dashboardBefore = dashCount ?? 0;
    const publicVideos = pubCount ?? 0;
    let inserted = 0;

    if (publicVideos > dashboardBefore) {
      const { data: rows } = await supabaseAdmin
        .from("videos")
        .select("handle, video_url, published_at, views, likes, comments, shares, collect_count, thumbnail_url, caption, is_ad, is_sponsored")
        .eq("handle", handle);

      const dashRows = (rows ?? []).map((v) => ({
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
        last_updated: new Date().toISOString(),
      }));

      const BATCH = 100;
      for (let i = 0; i < dashRows.length; i += BATCH) {
        const batch = dashRows.slice(i, i + BATCH);
        const { error } = await supabaseAdmin
          .from("dashboard_videos")
          .upsert(batch, { onConflict: "video_url", ignoreDuplicates: true });
        if (error) {
          return NextResponse.json(
            { error: `Backfill ${handle}: ${error.message}`, results },
            { status: 500 }
          );
        }
        inserted += batch.length;
      }
    }

    results.push({
      handle,
      dashboard_before: dashboardBefore,
      public_videos: publicVideos,
      inserted,
    });
  }

  return NextResponse.json({ ok: true, handles: handles.length, results });
}
