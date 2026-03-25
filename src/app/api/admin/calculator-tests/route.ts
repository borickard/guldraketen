import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sort = searchParams.get("sort") ?? "newest";

  let query = supabaseAdmin.from("calculator_tests").select("*");

  if (sort === "er") {
    query = query.order("engagement_rate", { ascending: false, nullsFirst: false });
  } else if (sort === "oldest") {
    query = query.order("tested_at", { ascending: true });
  } else if (sort === "handle") {
    query = query.order("handle", { ascending: true, nullsFirst: false });
  } else {
    query = query.order("tested_at", { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
