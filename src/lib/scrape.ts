import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { uploadThumbnailsBatch, uploadAvatar, isStoredThumbnail } from "@/lib/thumbnails";

const APIFY_ACTOR_ID = "clockworks~tiktok-profile-scraper";
const APIFY_API_BASE = "https://api.apify.com/v2";
const DAYS_BACK = 14;
const RESULTS_PER_PROFILE = 100;

// ─── Starta Apify-jobb asynkront ──────────────────────────────────────────────
// Returnerar direkt med ett runId – väntar INTE på att scraping ska bli klar.
// Apify kallar på webhookUrl när jobbet är klart.

export async function startScrape(
    webhookUrl: string,
    daysBack = 14,
    triggeredBy: "cron" | "manual" = "manual"
): Promise<{ runId: string; handles: number; scrapeRunId: string }> {
    const apifyToken = process.env.APIFY_TOKEN;
    if (!apifyToken) throw new Error("APIFY_TOKEN saknas");

    const { data: accounts, error } = await supabaseAdmin
        .from("accounts")
        .select("handle")
        .eq("is_active", true);

    if (error) throw new Error(error.message);

    const handles = (accounts ?? []).map((a: { handle: string }) => a.handle);
    if (handles.length === 0) throw new Error("Inga aktiva konton");

    // Insert scrape_runs row before starting Apify
    const { data: runRow, error: insertErr } = await supabaseAdmin
        .from("scrape_runs")
        .insert({ triggered_by: triggeredBy, days_back: daysBack, handles: handles.length, status: "started" })
        .select("id")
        .single();
    if (insertErr) console.error("scrape_runs insert error:", insertErr.message);
    const scrapeRunId: string = runRow?.id ?? "";

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    // Starta körning med webhook definierad som query-parameter (base64-kodad)
    const url = `${APIFY_API_BASE}/acts/${encodeURIComponent(APIFY_ACTOR_ID)}/runs` +
        `?webhooks=${encodeURIComponent(btoa(JSON.stringify([
            {
                eventTypes: ["ACTOR.RUN.SUCCEEDED"],
                requestUrl: webhookUrl,
            }
        ])))}`;

    let res: Response;
    try {
        res = await fetch(url, {
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
    } catch (err) {
        if (scrapeRunId) {
            await supabaseAdmin.from("scrape_runs").update({
                status: "failed",
                error: err instanceof Error ? err.message : String(err),
                completed_at: new Date().toISOString(),
            }).eq("id", scrapeRunId);
        }
        throw err;
    }

    if (!res.ok) {
        const text = await res.text();
        const errMsg = `Apify start error ${res.status}: ${text}`;
        if (scrapeRunId) {
            await supabaseAdmin.from("scrape_runs").update({
                status: "failed",
                error: errMsg,
                completed_at: new Date().toISOString(),
            }).eq("id", scrapeRunId);
        }
        throw new Error(errMsg);
    }

    const { data: run } = await res.json();

    // Store Apify run ID for webhook lookup
    if (scrapeRunId) {
        await supabaseAdmin.from("scrape_runs").update({ run_id: run.id }).eq("id", scrapeRunId);
    }

    return { runId: run.id, handles: handles.length, scrapeRunId };
}

// ─── Scrapa ett specifikt set av handles (backfill för nya konton) ────────────
// Hämtar de senaste `postsPerHandle` inläggen per konto oavsett datum.

export async function startScrapeForHandles(
    handles: string[],
    webhookUrl: string | null,
    postsPerHandle = 50,
    triggeredBy: "cron" | "manual" = "manual"
): Promise<{ runId: string; handles: number; scrapeRunId: string }> {
    const apifyToken = process.env.APIFY_TOKEN;
    if (!apifyToken) throw new Error("APIFY_TOKEN saknas");
    if (handles.length === 0) throw new Error("Inga handles angavs");

    const { data: runRow, error: insertErr } = await supabaseAdmin
        .from("scrape_runs")
        .insert({ triggered_by: triggeredBy, handles: handles.length, status: "started" })
        .select("id")
        .single();
    if (insertErr) console.error("scrape_runs insert error:", insertErr.message);
    const scrapeRunId: string = runRow?.id ?? "";

    const webhookParam = webhookUrl
        ? `?webhooks=${encodeURIComponent(btoa(JSON.stringify([
              { eventTypes: ["ACTOR.RUN.SUCCEEDED"], requestUrl: webhookUrl }
          ])))}`
        : "";
    const url = `${APIFY_API_BASE}/acts/${encodeURIComponent(APIFY_ACTOR_ID)}/runs${webhookParam}`;

    let res: Response;
    try {
        res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apifyToken}`,
            },
            body: JSON.stringify({
                profiles: handles,
                profileScrapeSections: ["videos"],
                profileSorting: "latest",
                resultsPerPage: postsPerHandle,
                excludePinnedPosts: false,
                oldestPostDateUnified: "2020-01-01", // far back — resultsPerPage is the real limit
            }),
        });
    } catch (err) {
        if (scrapeRunId) {
            await supabaseAdmin.from("scrape_runs").update({
                status: "failed",
                error: err instanceof Error ? err.message : String(err),
                completed_at: new Date().toISOString(),
            }).eq("id", scrapeRunId);
        }
        throw err;
    }

    if (!res.ok) {
        const text = await res.text();
        const errMsg = `Apify start error ${res.status}: ${text}`;
        if (scrapeRunId) {
            await supabaseAdmin.from("scrape_runs").update({
                status: "failed",
                error: errMsg,
                completed_at: new Date().toISOString(),
            }).eq("id", scrapeRunId);
        }
        throw new Error(errMsg);
    }

    const { data: run } = await res.json();
    if (scrapeRunId) {
        await supabaseAdmin.from("scrape_runs").update({ run_id: run.id }).eq("id", scrapeRunId);
    }

    return { runId: run.id, handles: handles.length, scrapeRunId };
}

// ─── Bearbeta Apify-resultat (anropas från webhook) ───────────────────────────
// Hämtar dataset-items via datasetId och skriver till Supabase.

export async function processScrapeResults(datasetId: string, apifyRunId?: string): Promise<ScrapeResult> {
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

    const { videoRows, followerMap, avatarMap, skipped } = parseApifyItems(items);

    // ── Critical path: upsert videos first (with original thumbnail URLs) ────────
    // Thumbnail uploads are slow and can exhaust Vercel's function timeout.
    // We write video rows now so data is safe, then upload thumbnails afterwards.
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

    // Uppdatera följarantal
    const now = new Date().toISOString();
    for (const [handle, followers] of Object.entries(followerMap)) {
        await supabaseAdmin
            .from("accounts")
            .update({ followers, followers_updated_at: now })
            .eq("handle", handle);
    }

    // Snapshot followers per ISO week — used by dashboard trend display.
    // Repeated scrapes within the same week just overwrite the row.
    const isoWeek = toISOWeek(new Date());
    const snapshotRows = Object.entries(followerMap).map(([handle, followers]) => ({
        handle,
        iso_week: isoWeek,
        followers,
    }));
    if (snapshotRows.length > 0) {
        const { error: snapErr } = await supabaseAdmin
            .from("follower_snapshots")
            .upsert(snapshotRows, { onConflict: "handle,iso_week" });
        if (snapErr) console.error("follower_snapshots upsert error:", snapErr.message);
    }

    // Daily follower history — captured_date is today; UPSERT keeps the
    // latest count for any given handle+date. Used by the dashboard
    // follower trend chart.
    const today = new Date().toISOString().slice(0, 10);
    const historyRows = Object.entries(followerMap).map(([handle, followers]) => ({
        handle,
        captured_date: today,
        followers,
    }));
    if (historyRows.length > 0) {
        const { error: histErr } = await supabaseAdmin
            .from("follower_history")
            .upsert(historyRows, { onConflict: "handle,captured_date" });
        if (histErr) console.error("follower_history upsert error:", histErr.message);
    }

    // Ladda upp avatarer till Supabase Storage och spara URL
    for (const [handle, rawAvatarUrl] of Object.entries(avatarMap)) {
        if (isStoredThumbnail(rawAvatarUrl)) {
            await supabaseAdmin
                .from("accounts")
                .update({ avatar_url: rawAvatarUrl })
                .eq("handle", handle);
        } else {
            const stored = await uploadAvatar(handle, rawAvatarUrl);
            if (stored) {
                await supabaseAdmin
                    .from("accounts")
                    .update({ avatar_url: stored })
                    .eq("handle", handle);
            }
        }
    }

    const result: ScrapeResult = {
        message: "Klar",
        upserted,
        skipped,
        followers: Object.keys(followerMap).length,
    };

    // Mark scrape_run completed BEFORE thumbnail uploads (thumbnails are slow)
    if (apifyRunId) {
        await supabaseAdmin
            .from("scrape_runs")
            .update({
                status: "completed",
                upserted,
                skipped,
                followers: result.followers,
                completed_at: new Date().toISOString(),
            })
            .eq("run_id", apifyRunId);
    }

    // ── Best-effort: upload thumbnails to Supabase Storage ───────────────────────
    // uploadThumbnailsBatch mutates thumbnail_url in-place on each row.
    // After uploading, patch only the rows that now have a stored URL.
    try {
        await uploadThumbnailsBatch(videoRows);
        const stored = videoRows.filter(r => r.thumbnail_url && isStoredThumbnail(r.thumbnail_url));
        for (let i = 0; i < stored.length; i += BATCH) {
            const batchRows = stored.slice(i, i + BATCH);
            await Promise.all(
                batchRows.map(row =>
                    supabaseAdmin
                        .from("videos")
                        .update({ thumbnail_url: row.thumbnail_url })
                        .eq("video_url", row.video_url)
                )
            );
        }
    } catch {
        // Thumbnail upload failures are non-fatal — videos and run record are already saved
    }

    return result;
}

// ─── Parse Apify dataset items into typed rows ────────────────────────────────
// Shared by the weekly cron (writes to `videos`) and the daily dashboard cron
// (writes to `dashboard_videos`).

export interface ParsedApify {
    videoRows: VideoRow[];
    followerMap: Record<string, number>;
    avatarMap: Record<string, string>;
    skipped: number;
}

export function parseApifyItems(items: ApifyItem[]): ParsedApify {
    const videoRows: VideoRow[] = [];
    const followerMap: Record<string, number> = {};
    const avatarMap: Record<string, string> = {};
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
        const collectCount = firstNumber(
            stats.collectCount,
            stats.bookmarkCount,
            stats.collect_count,
            it.collectCount,
            it.bookmarkCount
        );
        const isAd = firstBoolean(it.isAd, it.is_ad);
        const isSponsored = firstBoolean(it.isSponsored, it.is_sponsored);

        const thumbnailUrl =
            it?.videoMeta?.coverUrl ||
            it?.covers?.default ||
            it?.cover ||
            it?.thumbnail ||
            null;

        const caption =
            it?.text ||
            it?.description ||
            it?.caption ||
            null;

        const captionTrimmed = caption ? caption.slice(0, 500) : null;

        videoRows.push({
            handle,
            video_url: videoUrl,
            published_at: publishedAt.toISOString(),
            views: views ?? 0,
            likes: likes ?? 0,
            comments: comments ?? 0,
            shares: shares ?? 0,
            collect_count: collectCount,
            thumbnail_url: thumbnailUrl,
            caption: captionTrimmed,
            is_contest: detectContest(captionTrimmed),
            is_ad: isAd,
            is_sponsored: isSponsored,
            last_updated: new Date().toISOString(),
        });

        const fans = it?.authorMeta?.fans ?? it?.authorStats?.followerCount ?? null;
        if (fans !== null && !(handle in followerMap)) {
            followerMap[handle] = fans;
        }

        const avatarUrl =
            it?.authorMeta?.avatar ||
            it?.authorMeta?.avatarLarger ||
            it?.authorMeta?.avatarMedium ||
            it?.authorMeta?.avatarThumb ||
            null;
        if (avatarUrl && !(handle in avatarMap)) {
            avatarMap[handle] = avatarUrl;
        }
    }

    return { videoRows, followerMap, avatarMap, skipped };
}

// ─── Contest detection ────────────────────────────────────────────────────────

const CONTEST_KEYWORDS = ["tävling", "tävla", "vinn", "vinnare", "giveaway"];

function detectContest(caption: string | null): boolean {
    if (!caption) return false;
    const lower = caption.toLowerCase();
    return CONTEST_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScrapeResult {
    message: string;
    upserted: number;
    skipped: number;
    followers: number;
}

export interface VideoRow {
    handle: string;
    video_url: string;
    published_at: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    collect_count: number | null;
    thumbnail_url: string | null;
    caption: string | null;
    is_contest: boolean;
    is_ad: boolean | null;
    is_sponsored: boolean | null;
    last_updated: string;
}

export interface ApifyItem {
    authorMeta?: { name?: string; fans?: number; avatar?: string; avatarLarger?: string; avatarMedium?: string; avatarThumb?: string };
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
    collectCount?: number;
    bookmarkCount?: number;
    isAd?: boolean;
    is_ad?: boolean;
    isSponsored?: boolean;
    is_sponsored?: boolean;
    videoMeta?: { coverUrl?: string };
    covers?: { default?: string };
    cover?: string;
    thumbnail?: string;
    text?: string;
    description?: string;
    caption?: string;
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

function toISOWeek(date: Date): string {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
    const week1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function firstNumber(...vals: unknown[]): number | null {
    for (const v of vals) {
        if (v === 0) return 0;
        const n = Number(v);
        if (!isNaN(n) && isFinite(n)) return n;
    }
    return null;
}

// Returns the first boolean present in the inputs. Null means "field absent in
// payload" (not tracked yet) — distinct from explicit false.
function firstBoolean(...vals: unknown[]): boolean | null {
    for (const v of vals) {
        if (typeof v === "boolean") return v;
    }
    return null;
}