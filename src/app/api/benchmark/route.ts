import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

const SWEDISH_MONTHS = [
  "Januari", "Februari", "Mars", "April", "Maj", "Juni",
  "Juli", "Augusti", "September", "Oktober", "November", "December",
];

export async function GET() {
  const now = new Date();
  const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const firstOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  const period =
    SWEDISH_MONTHS[firstOfLastMonth.getUTCMonth()] +
    " " +
    firstOfLastMonth.getUTCFullYear();

  const fields = "engagement_rate";
  const { data, error } = await supabaseAdmin
    .from("videos")
    .select(fields)
    .gte("published_at", firstOfLastMonth.toISOString())
    .lt("published_at", firstOfMonth.toISOString())
    .gte("views", 1000)
    .not("engagement_rate", "is", null)
    .order("engagement_rate", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rates = (data ?? []).map((r) => Number(r.engagement_rate));
  const count = rates.length;

  if (count < 10) {
    return NextResponse.json({ count: 0, average: 0, median: 0, p75: 0, p90: 0, period });
  }

  const average = rates.reduce((s, v) => s + v, 0) / count;
  const median = rates[Math.floor(count / 2)];
  const p75 = rates[Math.floor(count * 0.75)];
  const p90 = rates[Math.floor(count * 0.90)];

  return NextResponse.json({
    count,
    average: Math.round(average * 10000) / 10000,
    median: Math.round(median * 10000) / 10000,
    p75: Math.round(p75 * 10000) / 10000,
    p90: Math.round(p90 * 10000) / 10000,
    period,
  });
}
