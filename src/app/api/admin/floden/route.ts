import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SORT_COLUMNS: Record<string, string> = {
  published: "published_at",
  er: "engagement_rate",
  views: "views",
  likes: "likes",
  comments: "comments",
  shares: "shares",
  collects: "collect_count",
};

const STATUSES = new Set(["all", "visible", "hidden", "contest"]);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "100", 10) || 100));

  const sortKey = searchParams.get("sort") ?? "published";
  const sortColumn = SORT_COLUMNS[sortKey] ?? "published_at";
  const category = searchParams.get("category")?.trim() ?? "";
  const handlesParam = searchParams.get("handles")?.trim() ?? "";
  const handles = handlesParam
    ? handlesParam.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
    : [];
  const status = STATUSES.has(searchParams.get("status") ?? "") ? searchParams.get("status")! : "all";

  const fields =
    "id, handle, video_url, thumbnail_url, caption, published_at, views, likes, comments, shares, collect_count, engagement_rate, is_contest, contest_approved, is_hidden, accounts!inner ( display_name, avatar_url, category )";

  let q = supabaseAdmin
    .from("videos")
    .select(fields)
    .order(sortColumn, { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (handles.length > 0) {
    q = q.in("handle", handles);
  }
  if (category) {
    q = q.eq("accounts.category", category);
  }
  if (status === "visible") {
    q = q.eq("is_hidden", false).eq("is_contest", false);
  } else if (status === "hidden") {
    q = q.eq("is_hidden", true);
  } else if (status === "contest") {
    q = q.eq("is_contest", true);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const id = body.id;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if ("is_contest" in body) {
    update.is_contest = !!body.is_contest;
    if (!body.is_contest) update.contest_approved = false;
  }
  if ("is_hidden" in body) {
    update.is_hidden = !!body.is_hidden;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("videos").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Bust CDN cache for routes that surface the public ranking so admin
  // changes (hide / flag as contest) are reflected on the homepage and
  // HoF straight away instead of waiting out the s-maxage window.
  try {
    revalidatePath("/");
    revalidatePath("/hall-of-fame");
    revalidatePath("/api/videos");
    revalidatePath("/api/tidigare-raketer");
    revalidatePath("/api/topplistan");
  } catch {}

  return NextResponse.json({ ok: true });
}
