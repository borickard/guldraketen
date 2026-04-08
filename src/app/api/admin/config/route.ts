import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextRequest, NextResponse } from "next/server";

// GET — return all app_config key/value pairs as a flat object
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("app_config")
    .select("key, value");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const config: Record<string, string> = {};
  for (const row of data ?? []) {
    config[row.key] = row.value;
  }
  return NextResponse.json(config);
}

// PATCH — upsert one or more key/value pairs, e.g. { calculator_enabled: "false" }
export async function PATCH(req: NextRequest) {
  const updates: Record<string, string> = await req.json();
  const upserts = Object.entries(updates).map(([key, value]) => ({ key, value }));

  const { error } = await supabaseAdmin
    .from("app_config")
    .upsert(upserts, { onConflict: "key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
