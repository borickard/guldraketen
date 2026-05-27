import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "100", 10) || 100));

  const fields =
    "id, handle, video_url, thumbnail_url, caption, published_at, views, likes, comments, shares, engagement_rate, is_contest, contest_approved, accounts ( display_name, avatar_url, category )";

  const { data, error } = await supabaseAdmin
    .from("videos")
    .select(fields)
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PATCH(req: NextRequest) {
  const { id, is_contest } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const update: Record<string, unknown> = { is_contest: !!is_contest };
  if (!is_contest) update.contest_approved = false;

  const { error } = await supabaseAdmin.from("videos").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
