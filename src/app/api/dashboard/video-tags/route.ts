import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifySession, COOKIE_NAME } from "@/lib/dashboardAuth";

// Returns a map of video_url -> tag_id[] for every tag the logged-in user owns.
// The grid merges this onto its videos to render tag chips.
export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: tags, error: tagErr } = await supabaseAdmin
    .from("content_tags")
    .select("id")
    .eq("user_id", session.userId);
  if (tagErr) return NextResponse.json({ error: tagErr.message }, { status: 500 });

  const tagIds = (tags ?? []).map((t) => t.id);
  if (tagIds.length === 0) return NextResponse.json({});

  const { data: maps, error: mapErr } = await supabaseAdmin
    .from("video_tag_map")
    .select("video_url, tag_id")
    .in("tag_id", tagIds);
  if (mapErr) return NextResponse.json({ error: mapErr.message }, { status: 500 });

  const out: Record<string, string[]> = {};
  for (const m of maps ?? []) {
    (out[m.video_url] ??= []).push(m.tag_id);
  }
  return NextResponse.json(out);
}
