import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextRequest, NextResponse } from "next/server";

function weekBounds(weekStr: string): { start: Date; end: Date } {
    const [yearStr, weekStr2] = weekStr.split("-W");
    const year = parseInt(yearStr);
    const week = parseInt(weekStr2);
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const startOfWeek1 = new Date(jan4);
    startOfWeek1.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
    const start = new Date(startOfWeek1);
    start.setUTCDate(startOfWeek1.getUTCDate() + (week - 1) * 7);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 7);
    return { start, end };
}

export async function GET(req: NextRequest) {
    const week = req.nextUrl.searchParams.get("week");
    const rank = parseInt(req.nextUrl.searchParams.get("rank") || "0");

    if (!week || !/^\d{4}-W\d{2}$/.test(week) || rank < 1) {
        return NextResponse.json({ error: "Ogiltiga parametrar" }, { status: 400 });
    }

    const { start, end } = weekBounds(week);

    const fields =
        "handle, video_url, published_at, views, likes, comments, shares, engagement_rate, thumbnail_url, caption, accounts ( followers, display_name )";

    const { data, error } = await supabaseAdmin
        .from("videos")
        .select(fields)
        .gte("published_at", start.toISOString())
        .lt("published_at", end.toISOString())
        .gte("views", 10000)
        .order("engagement_rate", { ascending: false })
        .limit(200);

    if (error || !data) {
        return NextResponse.json({ error: "Hittades inte" }, { status: 404 });
    }

    // Group by account — one best video per handle (same logic as front page)
    const byHandle = new Map<string, typeof data[0]>();
    for (const v of data) {
        if (!byHandle.has(v.handle) || (v.engagement_rate ?? 0) > (byHandle.get(v.handle)!.engagement_rate ?? 0)) {
            byHandle.set(v.handle, v);
        }
    }
    const ranked = Array.from(byHandle.values())
        .sort((a, b) => (b.engagement_rate ?? 0) - (a.engagement_rate ?? 0));

    if (ranked.length < rank) {
        return NextResponse.json({ error: "Hittades inte" }, { status: 404 });
    }

    return NextResponse.json(ranked[rank - 1]);
}