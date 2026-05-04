import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

const SWEDISH_MONTHS = [
  "Januari", "Februari", "Mars", "April", "Maj", "Juni",
  "Juli", "Augusti", "September", "Oktober", "November", "December",
];

function percentiles(rates: number[]) {
  const count = rates.length;
  const average = rates.reduce((s, v) => s + v, 0) / count;
  const median = rates[Math.floor(count / 2)];
  const p75 = rates[Math.floor(count * 0.75)];
  const p90 = rates[Math.floor(count * 0.90)];
  return {
    count,
    average: Math.round(average * 10000) / 10000,
    median: Math.round(median * 10000) / 10000,
    p75: Math.round(p75 * 10000) / 10000,
    p90: Math.round(p90 * 10000) / 10000,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  // ── Category mode: all-time, filtered to accounts in that category ──────────
  if (category) {
    const { data: accountData, error: acctErr } = await supabaseAdmin
      .from("accounts")
      .select("handle")
      .eq("category", category)
      .eq("is_active", true);

    if (acctErr) return NextResponse.json({ error: acctErr.message }, { status: 500 });

    const handles = (accountData ?? []).map((a) => a.handle);
    if (handles.length === 0) {
      return NextResponse.json({ count: 0, average: 0, median: 0, p75: 0, p90: 0, period: category });
    }

    const { data, error } = await supabaseAdmin
      .from("videos")
      .select("engagement_rate")
      .in("handle", handles)
      .gte("views", 1000)
      .not("engagement_rate", "is", null)
      .order("engagement_rate", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rates = (data ?? []).map((r) => Number(r.engagement_rate));
    if (rates.length < 10) {
      return NextResponse.json({ count: rates.length, average: 0, median: 0, p75: 0, p90: 0, period: category });
    }

    const res = NextResponse.json({ ...percentiles(rates), period: category });
    res.headers.set("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    return res;
  }

  // ── Global mode: last full calendar month ───────────────────────────────────
  const now = new Date();
  const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const firstOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const period =
    SWEDISH_MONTHS[firstOfLastMonth.getUTCMonth()] + " " + firstOfLastMonth.getUTCFullYear();

  const { data, error } = await supabaseAdmin
    .from("videos")
    .select("engagement_rate")
    .gte("published_at", firstOfLastMonth.toISOString())
    .lt("published_at", firstOfMonth.toISOString())
    .gte("views", 1000)
    .not("engagement_rate", "is", null)
    .order("engagement_rate", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rates = (data ?? []).map((r) => Number(r.engagement_rate));
  if (rates.length < 10) {
    return NextResponse.json({ count: 0, average: 0, median: 0, p75: 0, p90: 0, period });
  }

  const res = NextResponse.json({ ...percentiles(rates), period });
  res.headers.set("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  return res;
}
