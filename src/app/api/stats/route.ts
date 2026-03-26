import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

export async function GET() {
  const [videoRes, accountRes] = await Promise.all([
    supabaseAdmin.from("videos").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("accounts").select("*", { count: "exact", head: true }).eq("is_active", true),
  ]);

  return NextResponse.json({
    video_count: videoRes.count ?? 0,
    account_count: accountRes.count ?? 0,
  });
}
