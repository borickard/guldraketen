import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifySession, COOKIE_NAME } from "@/lib/dashboardAuth";

// Persists the user's most-recent comparison list to users.compare_handles (text[]).
// Required SQL migration:
//   ALTER TABLE users ADD COLUMN compare_handles text[] NOT NULL DEFAULT '{}';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: row, error } = await supabaseAdmin
    .from("users")
    .select("compare_handles")
    .eq("id", session.userId)
    .single();

  if (error) return NextResponse.json([]);
  const stored: string[] = row?.compare_handles ?? [];

  if (stored.length === 0) return NextResponse.json([]);

  const { data: existing } = await supabaseAdmin
    .from("accounts")
    .select("handle")
    .in("handle", stored)
    .eq("is_active", true);

  const valid = new Set((existing ?? []).map((a) => a.handle));
  const filtered = stored.filter((h) => valid.has(h));
  return NextResponse.json(filtered);
}

export async function PUT(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const handles: unknown = body?.handles;
  if (!Array.isArray(handles) || !handles.every((h) => typeof h === "string")) {
    return NextResponse.json({ error: "handles must be string[]" }, { status: 400 });
  }
  const clean = (handles as string[]).map((h) => h.trim().toLowerCase()).filter(Boolean);

  if (clean.length > 0) {
    const { data: existing } = await supabaseAdmin
      .from("accounts")
      .select("handle")
      .in("handle", clean)
      .eq("is_active", true);
    const valid = new Set((existing ?? []).map((a) => a.handle));
    const filtered = clean.filter((h) => valid.has(h));
    if (filtered.length !== clean.length) {
      return NextResponse.json({ error: "Some handles are not tracked" }, { status: 400 });
    }
  }

  const { error } = await supabaseAdmin
    .from("users")
    .update({ compare_handles: clean })
    .eq("id", session.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, handles: clean });
}
