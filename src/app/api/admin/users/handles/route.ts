import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

// Copy a handle's full history from the public `videos` table into
// dashboard_videos so a freshly-linked dashboard account shows its content
// immediately instead of waiting for the 03:00 daily cron. Fast, no Apify.
// ignoreDuplicates keeps any rows a prior scrape already wrote (with real
// is_ad); seeded rows get is_ad/is_sponsored null until a dashboard scrape
// (daily, or the deep /api/admin/dashboard-refresh) overwrites them.
async function seedHandleFromPublic(handle: string): Promise<number> {
  try {
    const { data: rows } = await supabaseAdmin
      .from("videos")
      .select("handle, video_url, published_at, views, likes, comments, shares, collect_count, thumbnail_url, caption")
      .eq("handle", handle);
    if (!rows || rows.length === 0) return 0;

    const dashRows = rows.map((v) => ({
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
      is_ad: null,
      is_sponsored: null,
      last_updated: new Date().toISOString(),
    }));

    const BATCH = 100;
    let inserted = 0;
    for (let i = 0; i < dashRows.length; i += BATCH) {
      const batch = dashRows.slice(i, i + BATCH);
      const { error } = await supabaseAdmin
        .from("dashboard_videos")
        .upsert(batch, { onConflict: "video_url", ignoreDuplicates: true });
      if (error) {
        console.error(`seedHandleFromPublic (${handle}):`, error.message);
        break;
      }
      inserted += batch.length;
    }
    return inserted;
  } catch (err) {
    console.error("seedHandleFromPublic failed:", err);
    return 0;
  }
}

export async function POST(req: Request) {
  const { user_id, handle } = await req.json();
  if (!user_id || !handle) return NextResponse.json({ error: "user_id och handle krävs" }, { status: 400 });

  const { error } = await supabaseAdmin.from("user_handles").insert({ user_id, handle });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Seed the dashboard immediately so the account isn't empty until 03:00.
  // Non-fatal: the link itself already succeeded.
  const seeded = await seedHandleFromPublic(handle);

  return NextResponse.json({ ok: true, seeded }, { status: 201 });
}

export async function DELETE(req: Request) {
  const { user_id, handle } = await req.json();

  const { error } = await supabaseAdmin
    .from("user_handles")
    .delete()
    .eq("user_id", user_id)
    .eq("handle", handle);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
