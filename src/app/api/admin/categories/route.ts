import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CATEGORIES } from "@/lib/categories";

export async function GET() {
  const [{ data: visRows }, { data: accounts }] = await Promise.all([
    supabaseAdmin.from("category_visibility").select("name, is_visible"),
    supabaseAdmin
      .from("accounts")
      .select("category")
      .eq("is_active", true),
  ]);

  const hidden = new Set(
    (visRows ?? []).filter((r) => r.is_visible === false).map((r) => r.name)
  );

  const counts = new Map<string, number>();
  for (const a of accounts ?? []) {
    if (!a.category) continue;
    counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
  }

  // Include any orphan categories (assigned to accounts but not in CATEGORIES list)
  // so the admin can spot rows that need cleanup.
  const known = new Set<string>(CATEGORIES);
  const orphans = Array.from(counts.keys()).filter((c) => !known.has(c));

  const result = [
    ...CATEGORIES.map((name) => ({
      name,
      is_visible: !hidden.has(name),
      account_count: counts.get(name) ?? 0,
      is_orphan: false,
    })),
    ...orphans.map((name) => ({
      name,
      is_visible: !hidden.has(name),
      account_count: counts.get(name) ?? 0,
      is_orphan: true,
    })),
  ];

  return NextResponse.json(result);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name: unknown = body?.name;
  const is_visible: unknown = body?.is_visible;
  if (typeof name !== "string" || typeof is_visible !== "boolean") {
    return NextResponse.json(
      { error: "name (string) och is_visible (boolean) krävs" },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("category_visibility")
    .upsert(
      { name, is_visible, updated_at: new Date().toISOString() },
      { onConflict: "name" }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
