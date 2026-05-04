import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("accounts")
    .select("category")
    .eq("is_active", true)
    .not("category", "is", null)
    .order("category");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const categories = [...new Set((data ?? []).map((r) => r.category as string))].sort();

  const res = NextResponse.json(categories);
  res.headers.set("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  return res;
}
