import { supabaseAdmin } from "@/lib/supabaseAdmin";

export interface VideoForRank {
    handle: string;
    video_url: string;
    published_at: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    engagement_rate: number;
    thumbnail_url: string | null;
    caption: string | null;
    accounts: { followers: number; display_name?: string | null } | { followers: number; display_name?: string | null }[] | null;
}

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

function toISOWeek(date: Date): string {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
    const week1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function isWeekPublished(weekStr: string): boolean {
    const currentWeek = toISOWeek(new Date());
    const [yr, wk] = currentWeek.split("-W").map(Number);
    const jan4 = new Date(Date.UTC(yr, 0, 4));
    const currentMon = new Date(jan4);
    currentMon.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (wk - 1) * 7);
    const prevMon = new Date(currentMon);
    prevMon.setUTCDate(currentMon.getUTCDate() - 7);
    const previousWeek = toISOWeek(prevMon);
    return weekStr !== currentWeek && weekStr !== previousWeek;
}

export async function getVideoForRank(week: string, rank: number): Promise<VideoForRank | null> {
    if (!week || !/^\d{4}-W\d{2}$/.test(week) || rank < 1) return null;
    if (!isWeekPublished(week)) return null;

    const { start, end } = weekBounds(week);

    const fields =
        "handle, video_url, published_at, views, likes, comments, shares, engagement_rate, thumbnail_url, caption, accounts ( followers, display_name )";

    const { data, error } = await supabaseAdmin
        .from("videos")
        .select(fields)
        .gte("published_at", start.toISOString())
        .lt("published_at", end.toISOString())
        .or("is_contest.eq.false,contest_approved.eq.true")
        .order("engagement_rate", { ascending: false })
        .limit(200);

    if (error || !data) return null;

    const byHandle = new Map<string, typeof data[0]>();
    for (const v of data) {
        if ((v.views ?? 0) < 10_000) continue;
        if (!byHandle.has(v.handle) || (v.engagement_rate ?? 0) > (byHandle.get(v.handle)!.engagement_rate ?? 0)) {
            byHandle.set(v.handle, v);
        }
    }
    const ranked = Array.from(byHandle.values())
        .sort((a, b) => (b.engagement_rate ?? 0) - (a.engagement_rate ?? 0));

    return ranked[rank - 1] ?? null;
}
