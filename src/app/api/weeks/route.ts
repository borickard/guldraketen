import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

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
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 12 * 7);

    const { data, error } = await supabaseAdmin
        .from("videos")
        .select("published_at")
        .gte("published_at", cutoff.toISOString())
        .gte("views", 5000);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const currentWeek = toISOWeek(new Date());

    const weekSet = new Set<string>();
    for (const row of data ?? []) {
        if (row.published_at) {
            const w = toISOWeek(new Date(row.published_at));
            // Exkludera innevarande vecka – den är inte komplett
            if (w !== currentWeek) {
                weekSet.add(w);
            }
        }
    }

    const weeks = Array.from(weekSet).sort((a, b) => (b > a ? 1 : -1));
    return NextResponse.json(weeks);
}