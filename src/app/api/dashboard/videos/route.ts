import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifySession, COOKIE_NAME } from "@/lib/dashboardAuth";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Skip activity tracking when an admin is previewing via impersonate —
  // the session payload is marked at /api/admin/impersonate time. A real
  // login (even by someone who also has an admin cookie) is not flagged.
  if (!session.impersonated) {
    void trackDashboardVisit(session.userId);
  }

  if (session.handles.length === 0) return NextResponse.json([]);

  const handleParam = req.nextUrl.searchParams.get("handle");
  const handles = handleParam && session.handles.includes(handleParam)
    ? [handleParam]
    : session.handles;

  const { data, error } = await supabaseAdmin
    .from("dashboard_videos")
    .select("id, handle, video_url, thumbnail_url, published_at, views, likes, comments, shares, collect_count, is_ad, engagement_rate, caption, is_excluded")
    .in("handle", handles)
    .order("published_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PATCH(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  if (typeof body.is_excluded !== "boolean") {
    return NextResponse.json({ error: "is_excluded måste vara boolean" }, { status: 400 });
  }
  if (session.handles.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Update only if the video belongs to a handle the user owns.
  const { data, error } = await supabaseAdmin
    .from("dashboard_videos")
    .update({ is_excluded: body.is_excluded })
    .eq("id", body.id)
    .in("handle", session.handles)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Inte hittad eller saknar behörighet" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

async function trackDashboardVisit(userId: string) {
  const { data: u } = await supabaseAdmin
    .from("users")
    .select("last_seen_at, active_days")
    .eq("id", userId)
    .maybeSingle();
  if (!u) return;
  const today = new Date().toISOString().slice(0, 10);
  const lastDay = u.last_seen_at ? new Date(u.last_seen_at).toISOString().slice(0, 10) : null;
  if (lastDay === today) return;
  await supabaseAdmin
    .from("users")
    .update({
      last_seen_at: new Date().toISOString(),
      active_days: (u.active_days ?? 0) + 1,
    })
    .eq("id", userId);
}
