import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const now = new Date();

  // Today — midnight UTC
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  // This ISO week — Monday midnight UTC
  const weekStart = new Date(todayStart);
  const day = weekStart.getUTCDay() || 7; // Sun=7, Mon=1
  weekStart.setUTCDate(weekStart.getUTCDate() - (day - 1));

  // This calendar month — 1st of month UTC
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [todayRes, weekRes, monthRes] = await Promise.all([
    supabaseAdmin
      .from("calculator_tests")
      .select("id", { count: "exact", head: true })
      .eq("source", "apify")
      .gte("tested_at", todayStart.toISOString()),
    supabaseAdmin
      .from("calculator_tests")
      .select("id", { count: "exact", head: true })
      .eq("source", "apify")
      .gte("tested_at", weekStart.toISOString()),
    supabaseAdmin
      .from("calculator_tests")
      .select("id", { count: "exact", head: true })
      .eq("source", "apify")
      .gte("tested_at", monthStart.toISOString()),
  ]);

  return NextResponse.json({
    today: todayRes.count ?? 0,
    week: weekRes.count ?? 0,
    month: monthRes.count ?? 0,
  });
}
