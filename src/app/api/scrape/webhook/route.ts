import { processScrapeResults } from "@/lib/scrape";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

// Give the webhook enough time to upload thumbnails for a full multi-account scrape
export const maxDuration = 300;

function toISOWeek(date: Date): string {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
    const week1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function prevWeek(weekStr: string): string {
    const [yr, wk] = weekStr.split("-W").map(Number);
    const jan4 = new Date(Date.UTC(yr, 0, 4));
    const mon = new Date(jan4);
    mon.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (wk - 1) * 7 - 7);
    return toISOWeek(mon);
}

function warmOgImages() {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.socialaraketer.se";
    const current = toISOWeek(new Date());
    // Warm the 3 most recently published weeks (current-2, current-3, current-4)
    const weeks = [
        prevWeek(prevWeek(current)),
        prevWeek(prevWeek(prevWeek(current))),
        prevWeek(prevWeek(prevWeek(prevWeek(current)))),
    ];
    for (const week of weeks) {
        fetch(`${siteUrl}/api/og/home?week=${week}`, { signal: AbortSignal.timeout(15000) })
            .catch(() => {/* fire-and-forget */});
    }
}

export async function POST(req: Request) {
    let apifyRunId: string | undefined;

    try {
        const body = await req.json();
        console.log("Webhook payload:", JSON.stringify(body, null, 2));

        // Apify standard-payload har datasetId under resource
        const datasetId =
            body?.resource?.defaultDatasetId ||
            body?.datasetId ||
            null;

        apifyRunId = body?.resource?.id || body?.runId || undefined;

        if (!datasetId) {
            console.error("Hittade inget datasetId:", body);
            if (apifyRunId) {
                await supabaseAdmin.from("scrape_runs").update({
                    status: "failed",
                    error: "datasetId saknas i webhook-payload",
                    completed_at: new Date().toISOString(),
                }).eq("run_id", apifyRunId);
            }
            return NextResponse.json({ error: "datasetId saknas", body }, { status: 400 });
        }

        const result = await processScrapeResults(datasetId, apifyRunId);
        warmOgImages();
        return NextResponse.json(result);
    } catch (err) {
        console.error("Webhook error:", err);
        if (apifyRunId) {
            await supabaseAdmin.from("scrape_runs").update({
                status: "failed",
                error: err instanceof Error ? err.message : String(err),
                completed_at: new Date().toISOString(),
            }).eq("run_id", apifyRunId);
        }
        return NextResponse.json(
            { error: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}
