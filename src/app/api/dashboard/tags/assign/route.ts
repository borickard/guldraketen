import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifySession, COOKIE_NAME } from "@/lib/dashboardAuth";

// Bulk add/remove a tag on one or more videos. Verifies both that the tag
// belongs to the user and that the videos belong to a handle the user owns.
export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const tagId = body.tag_id;
  const action = body.action === "remove" ? "remove" : "add";
  const videoUrls: string[] = Array.isArray(body.video_urls)
    ? body.video_urls.filter((u: unknown) => typeof u === "string" && u.length > 0)
    : [];
  if (!tagId || videoUrls.length === 0) {
    return NextResponse.json({ error: "tag_id och video_urls krävs" }, { status: 400 });
  }

  // Tag must belong to this user.
  const { data: tag } = await supabaseAdmin
    .from("content_tags")
    .select("id")
    .eq("id", tagId)
    .eq("user_id", session.userId)
    .maybeSingle();
  if (!tag) return NextResponse.json({ error: "Taggen hittades inte" }, { status: 404 });

  if (session.handles.length === 0) {
    return NextResponse.json({ error: "Inga konton kopplade" }, { status: 403 });
  }

  // Only allow video_urls that belong to a handle the user owns.
  const { data: owned } = await supabaseAdmin
    .from("dashboard_videos")
    .select("video_url")
    .in("video_url", videoUrls)
    .in("handle", session.handles);
  const allowed = (owned ?? []).map((r) => r.video_url);
  if (allowed.length === 0) {
    return NextResponse.json({ error: "Inga av videorna tillhör dina konton" }, { status: 403 });
  }

  if (action === "add") {
    const rows = allowed.map((video_url) => ({ video_url, tag_id: tagId }));
    const { error } = await supabaseAdmin
      .from("video_tag_map")
      .upsert(rows, { onConflict: "video_url,tag_id", ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabaseAdmin
      .from("video_tag_map")
      .delete()
      .eq("tag_id", tagId)
      .in("video_url", allowed);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, affected: allowed.length });
}
