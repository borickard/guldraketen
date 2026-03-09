import { processScrapeResults } from "@/lib/scrape";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        console.log("Webhook payload:", JSON.stringify(body, null, 2));

        // Apify standard-payload har datasetId under resource
        const datasetId =
            body?.resource?.defaultDatasetId ||
            body?.datasetId ||
            null;

        if (!datasetId) {
            console.error("Hittade inget datasetId:", body);
            return NextResponse.json({ error: "datasetId saknas", body }, { status: 400 });
        }

        const result = await processScrapeResults(datasetId);
        return NextResponse.json(result);
    } catch (err) {
        console.error("Webhook error:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}