import { supabaseAdmin } from "@/lib/supabaseAdmin";

const APIFY_ACTOR_ID = "clockworks~tiktok-profile-scraper";
const APIFY_API_BASE = "https://api.apify.com/v2";
const DAYS_BACK = 14;
const RESULTS_PER_PROFILE = 50;

// ─── Starta Apify-jobb asynkront ─────────────────────────────────────────────

export async function startScrape(webhookUrl: string): Promise<{ runId: string; handles: number }> {
    const apifyToken = process.env.APIFY_TOKEN;
    if (!apifyToken) throw new Error("APIFY_TOKEN saknas");

    const { data: accounts, error } = await supabaseAdmin
        .from("accounts")
        .select("handle")
        .eq("is_active", true);

    if (error) throw new Error(error.message);

    const handles = (accounts ?? []).map((a: { handle: string }) => a.handle);
    if (handles.length === 0) throw new Error("Inga aktiva konton");

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - DAYS_BACK);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    // Starta körning med webhook definierad som query-parameter
    const url = `${APIFY_API_BASE}/acts/${encodeURIComponent(APIFY_ACTOR_ID)}/runs` +
        `?webhooks=${encodeURIComponent(btoa(JSON.stringify([
            {
                eventTypes: ["ACTOR.RUN.SUCCEEDED"],
                requestUrl: webhookUrl,

            }
        ])))}`;

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apifyToken}`,
        },
        body: JSON.stringify({
            profiles: handles,
            profileScrapeSections: ["videos"],
            profileSorting: "latest",
            resultsPerPage: RESULTS_PER_PROFILE,
            excludePinnedPosts: true,
            oldestPostDateUnified: cutoffStr,
        }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Apify start error ${res.status}: ${text}`);
    }

    const { data: run } = await res.json();
    return { runId: run.id, handles: handles.length };
}

// ─── Bearbeta Apify-resultat (anropas från webhook) ───────────────────────────

export async function processScrapeResults(datasetId: string): Promise<ScrapeResult> {
    const apifyToken = process.env.APIFY_TOKEN;
    if (!apifyToken) throw new Error("APIFY_TOKEN saknas");

    const res = await fetch(
        `${APIFY_API_BASE}/datasets/${datasetId}/items?format=json&clean=true`,
        { headers: { Authorization: `Bearer ${apifyToken}` } }
    );

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Apify dataset error ${res.status}: ${text}`);
    }

    const items: ApifyItem[] = await res.json();

    const videoRows: VideoRow[] = [];
    const followerMap: Record<string, number> = {};
    let skipped = 0;

    for (const it of items) {
        const handle = it?.authorMeta?.name || it?.author?.uniqueId || it?.authorUniqueId || "";
        const videoUrl = it?.webVideoUrl || it?.videoUrl || it?.url || "";
        if (!handle || !videoUrl) { skipped++; continue; }

        const publishedAt = parseCreateTime(it?.createTime ?? it?.create_time ?? null);
        if (!publishedAt) { skipped++; continue; }

        const stats = it?.stats || it?.statistics || {};
        const views = firstNumber(stats.playCount, stats.viewCount, it.playCount, it.viewCount);
        const likes = firstNumber(stats.diggCount, stats.likeCount, it.diggCount, it.likeCount);
        const comments = firstNumber(stats.commentCount, it.commentCount);
        const shares = firstNumber(stats.shareCount, it.shareCount);

        const thumbnailUrl =
            it?.videoMeta?.coverUrl ||
            it?.covers?.default ||
            it?.cover ||
            it?.thumbnail ||
            null;

        videoRows.push({
            handle,
            video_url: videoUrl,
            published_at: publishedAt.toISOString(),
            views: views ?? 0,
            likes: likes ?? 0,
            comments: comments ?? 0,
            shares: shares ?? 0,
            thumbnail_url: thumbnailUrl,
            last_updated: new Date().toISOString(),
        });

        const fans = it?.authorMeta?.fans ?? it?.authorStats?.followerCount ?? null;
        if (fans !== null && !(handle in followerMap)) {
            followerMap[handle] = fans;
        }
    }

    const BATCH = 100;
    let upserted = 0;
    for (let i = 0; i < videoRows.length; i += BATCH) {
        const batch = videoRows.slice(i, i + BATCH);
        const { error } = await supabaseAdmin
            .from("videos")
            .upsert(batch, { onConflict: "video_url" });
        if (error) throw new Error(`Upsert videos: ${error.message}`);
        upserted += batch.length;
    }

    const now = new Date().toISOString();
    for (const [handle, followers] of Object.entries(followerMap)) {
        await supabaseAdmin
            .from("accounts")
            .update({ followers, followers_updated_at: now })
            .eq("handle", handle);
    }

    return {
        message: "Klar",
        upserted,
        skipped,
        followers: Object.keys(followerMap).length,
    };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScrapeResult {
    message: string;
    upserted: number;
    skipped: number;
    followers: number;
}

interface VideoRow {
    handle: string;
    video_url: string;
    published_at: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    thumbnail_url: string | null;
    last_updated: string;
}

interface ApifyItem {
    authorMeta?: { name?: string; fans?: number };
    author?: { uniqueId?: string };
    authorUniqueId?: string;
    authorStats?: { followerCount?: number };
    webVideoUrl?: string;
    videoUrl?: string;
    url?: string;
    createTime?: number | string;
    create_time?: number | string;
    stats?: Record<string, number>;
    statistics?: Record<string, number>;
    playCount?: number;
    viewCount?: number;
    diggCount?: number;
    likeCount?: number;
    commentCount?: number;
    shareCount?: number;
    videoMeta?: { coverUrl?: string };
    covers?: { default?: string };
    cover?: string;
    thumbnail?: string;
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function parseCreateTime(v: unknown): Date | null {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    if (!isNaN(n) && isFinite(n)) {
        const ms = n < 1e12 ? n * 1000 : n;
        const d = new Date(ms);
        return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(String(v));
    return isNaN(d.getTime()) ? null : d;
}

function firstNumber(...vals: unknown[]): number | null {
    for (const v of vals) {
        if (v === 0) return 0;
        const n = Number(v);
        if (!isNaN(n) && isFinite(n)) return n;
    }
    return null;
}