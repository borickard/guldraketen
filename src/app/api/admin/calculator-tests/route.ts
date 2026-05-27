import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sort = searchParams.get("sort") ?? "newest";

  let query = supabaseAdmin.from("calculator_tests").select("*");

  if (sort === "er") {
    query = query.order("engagement_rate", { ascending: false, nullsFirst: false });
  } else if (sort === "oldest") {
    query = query.order("tested_at", { ascending: true });
  } else if (sort === "handle") {
    query = query.order("handle", { ascending: true, nullsFirst: false });
  } else {
    query = query.order("tested_at", { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich each test with thumbnail_url by joining on video_url against
  // the videos table (no FK exists, so we do this client-side).
  const tests = data ?? [];
  const urls = tests.map((t) => t.video_url).filter(Boolean) as string[];
  let thumbMap = new Map<string, string | null>();
  if (urls.length > 0) {
    const { data: vids } = await supabaseAdmin
      .from("videos")
      .select("video_url, thumbnail_url")
      .in("video_url", urls);
    thumbMap = new Map((vids ?? []).map((v) => [v.video_url, v.thumbnail_url]));
  }

  const enriched = tests.map((t) => ({ ...t, thumbnail_url: thumbMap.get(t.video_url) ?? null }));
  return NextResponse.json(enriched);
}
