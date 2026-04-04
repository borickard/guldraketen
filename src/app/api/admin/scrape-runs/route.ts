import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

export async function GET() {
    const { data, error } = await supabaseAdmin
        .from("scrape_runs")
        .select("id, run_id, triggered_by, days_back, handles, status, error, upserted, skipped, followers, started_at, completed_at")
        .order("started_at", { ascending: false })
        .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
}
