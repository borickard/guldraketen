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

function isoWeekMinus(week: string, n: number): string {
    // Parse week string, subtract n weeks
    const [yearStr, weekStr] = week.split("-W");
    const year = parseInt(yearStr);
    const weekNum = parseInt(weekStr);
    // Get Monday of that week
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const startOfWeek1 = new Date(jan4);
    startOfWeek1.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
    const monday = new Date(startOfWeek1);
    monday.setUTCDate(startOfWeek1.getUTCDate() + (weekNum - 1) * 7 - n * 7);
    return toISOWeek(monday);
}

export async function GET() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 12 * 7);

    const { data, error } = await supabaseAdmin
        .from("videos")
        .select("published_at, handle")
        .gte("published_at", cutoff.toISOString())
        .gte("views", 5000);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const currentWeek = toISOWeek(new Date());
    const previousWeek = isoWeekMinus(currentWeek, 1);

    // Count distinct accounts per week — require at least 3 to show the week
    const weekHandles = new Map<string, Set<string>>();
    for (const row of data ?? []) {
        if (!row.published_at || !row.handle) continue;
        const w = toISOWeek(new Date(row.published_at));
        if (w === currentWeek || w === previousWeek) continue;
        if (!weekHandles.has(w)) weekHandles.set(w, new Set());
        weekHandles.get(w)!.add(row.handle);
    }

    const weeks = Array.from(weekHandles.entries())
        .filter(([, handles]) => handles.size >= 3)
        .map(([week]) => week)
        .sort((a, b) => (b > a ? 1 : -1));
    const res = NextResponse.json(weeks);
    res.headers.set("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    return res;
}