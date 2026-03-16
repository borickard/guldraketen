import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

// Returns ISO week string for a date, e.g. "2026-W10"
function toISOWeek(date: Date): string {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum =
        1 +
        Math.round(
            ((d.getTime() - week1.getTime()) / 86400000 -
                3 +
                ((week1.getDay() + 6) % 7)) /
            7
        );
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

export async function GET() {
    // Fetch published_at for all videos within last 12 weeks
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 12 * 7);

    const { data, error } = await supabaseAdmin
        .from("videos")
        .select("published_at")
        .gte("published_at", cutoff.toISOString())
        .gte("views", 5000);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Collect unique weeks
    const weekSet = new Set<string>();
    for (const row of data ?? []) {
        if (row.published_at) {
            weekSet.add(toISOWeek(new Date(row.published_at)));
        }
    }

    // Sort descending
    const weeks = Array.from(weekSet).sort((a, b) => (b > a ? 1 : -1));
    return NextResponse.json(weeks);
}