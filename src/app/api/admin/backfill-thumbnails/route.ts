import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isStoredThumbnail, uploadThumbnail } from "@/lib/thumbnails";
import { NextResponse } from "next/server";

const BATCH_SIZE = 50; // videos per call — call multiple times to process all

export async function POST() {
  // Fetch videos that still have TikTok CDN URLs
  const { data, error } = await supabaseAdmin
    .from("videos")
    .select("id, video_url, thumbnail_url")
    .not("thumbnail_url", "is", null)
    .order("last_updated", { ascending: false })
    .limit(BATCH_SIZE);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const videos = (data ?? []).filter(
    (v) => v.thumbnail_url && !isStoredThumbnail(v.thumbnail_url)
  );

  let uploaded = 0;
  let failed = 0;

  for (const v of videos) {
    const stored = await uploadThumbnail(v.thumbnail_url!, v.video_url);
    if (stored) {
      await supabaseAdmin
        .from("videos")
        .update({ thumbnail_url: stored })
        .eq("id", v.id);
      uploaded++;
    } else {
      failed++;
    }
  }

  const remaining = videos.length === BATCH_SIZE ? "möjligen fler kvar" : "klart";

  return NextResponse.json({ uploaded, failed, remaining });
}
