import { processScrapeResults } from "@/lib/scrape";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

// Give the webhook enough time to upload thumbnails for a full multi-account scrape
export const maxDuration = 300;

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
