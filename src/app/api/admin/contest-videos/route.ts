import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const fields = "id, handle, video_url, caption, views, published_at, is_contest, contest_approved, accounts ( display_name )";

  const { data, error } = await supabaseAdmin
    .from("videos")
    .select(fields)
    .eq("is_contest", true)
    .order("published_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const { id, contest_approved } = await req.json();

  const { error } = await supabaseAdmin
    .from("videos")
    .update({ contest_approved })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
