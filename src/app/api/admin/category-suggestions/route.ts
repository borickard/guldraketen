import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Sort = "name" | "date" | "videos";
type Order = "asc" | "desc";

function parseSort(s: string | null): Sort {
  if (s === "date" || s === "videos") return s;
  return "name";
}

function parseOrder(s: string | null): Order {
  return s === "desc" ? "desc" : "asc";
}

export async function GET(req: NextRequest) {
  const sort = parseSort(req.nextUrl.searchParams.get("sort"));
  const order = parseOrder(req.nextUrl.searchParams.get("order"));

  const { data: suggestions, error } = await supabaseAdmin
    .from("category_suggestions")
    .select("id, handle, display_name, suggested_category, email, motivation, created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const handles = Array.from(new Set((suggestions ?? []).map((s) => s.handle)));

  const videoCounts = new Map<string, number>();
  if (handles.length > 0) {
    const { data: videos } = await supabaseAdmin
      .from("videos")
      .select("handle")
      .in("handle", handles);
    for (const v of videos ?? []) {
      videoCounts.set(v.handle, (videoCounts.get(v.handle) ?? 0) + 1);
    }
  }

  const enriched = (suggestions ?? []).map((s) => ({
    ...s,
    video_count: videoCounts.get(s.handle) ?? 0,
  }));

  enriched.sort((a, b) => {
    let cmp = 0;
    if (sort === "name") {
      cmp = a.display_name.localeCompare(b.display_name, "sv");
    } else if (sort === "date") {
      cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    } else if (sort === "videos") {
      cmp = a.video_count - b.video_count;
    }
    return order === "asc" ? cmp : -cmp;
  });

  return NextResponse.json(enriched);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id krävs" }, { status: 400 });
  const { error } = await supabaseAdmin
    .from("category_suggestions")
    .delete()
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
