import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifySession, COOKIE_NAME } from "@/lib/dashboardAuth";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.handles.length === 0) return NextResponse.json([]);

  const handleParam = req.nextUrl.searchParams.get("handle");
  const handles = handleParam && session.handles.includes(handleParam)
    ? [handleParam]
    : session.handles;

  const { data, error } = await supabaseAdmin
    .from("videos")
    .select("id, handle, video_url, thumbnail_url, published_at, views, likes, comments, shares, engagement_rate, caption")
    .in("handle", handles)
    .order("published_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
