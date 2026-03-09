import { supabaseAdmin } from "@/lib/supabaseAdmin";

const APIFY_ACTOR_ID = "clockworks~tiktok-profile-scraper";
const APIFY_API_BASE = "https://api.apify.com/v2";
const DAYS_BACK = 14;
const RESULTS_PER_PROFILE = 50;

export interface ScrapeResult {
    message: string;
    handles: number;
    upserted: number;
    skipped: number;
    followers: number;
}

export async function runScrape(): Promise<ScrapeResult> {
    const apifyToken = process.env.APIFY_TOKEN;
    if (!apifyToken) throw new Error("APIFY_TOKEN saknas");

    // 1. Hämta aktiva handles från Supabase
    const { data: accounts, error: accountsError } = await supabaseAdmin
        .from("accounts")
        .select("handle")
        .eq("is_active", true);

    if (accountsError) throw new Error(accountsError.message);

    const handles = (accounts ?? []).map((a: { handle: string }) => a.handle);
    if (handles.length === 0) {
        return { message: "Inga aktiva konton", handles: 0, upserted: 0, skipped: 0, followers: 0 };
    }

    // 2. Kör Apify-scraping
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - DAYS_BACK);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    const apifyUrl =
        `${APIFY_API_BASE}/acts/${encodeURIComponent(APIFY_ACTOR_ID)}` +
        `/run-sync-get-dataset-items?format=json&clean=true`;

    const apifyResp = await fetch(apifyUrl, {
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

    if (!apifyResp.ok) {
        const text = await apifyResp.text();
        throw new Error(`Apify error ${apifyResp.status}: ${text}`);
    }

    const items: ApifyItem[] = await apifyResp.json();

    // 3. Bygg videorader + följaruppdateringar
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

        videoRows.push({
            handle,
            video_url: videoUrl,
            published_at: publishedAt.toISOString(),
            views: views ?? 0,
            likes: likes ?? 0,
            comments: comments ?? 0,
            shares: shares ?? 0,
            last_updated: new Date().toISOString(),
        });

        const fans = it?.authorMeta?.fans ?? it?.authorStats?.followerCount ?? null;
        if (fans !== null && !(handle in followerMap)) {
            followerMap[handle] = fans;
        }
    }

    // 4. Upserta videos i batchar
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

    // 5. Uppdatera följarantal
    const now = new Date().toISOString();
    for (const [handle, followers] of Object.entries(followerMap)) {
        await supabaseAdmin
            .from("accounts")
            .update({ followers, followers_updated_at: now })
            .eq("handle", handle);
    }

    return {
        message: "Klar",
        handles: handles.length,
        upserted,
        skipped,
        followers: Object.keys(followerMap).length,
    };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface VideoRow {
    handle: string;
    video_url: string;
    published_at: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
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