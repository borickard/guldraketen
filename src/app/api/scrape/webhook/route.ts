import { processScrapeResults } from "@/lib/scrape";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Logga hela payload så vi ser vad Apify faktiskt skickar
        console.log("Webhook payload:", JSON.stringify(body, null, 2));

        // Apify kan skicka datasetId på olika sätt
        const datasetId =
            body?.datasetId ||
            body?.resource?.defaultDatasetId ||
            body?.eventData?.defaultDatasetId ||
            null;

        if (!datasetId) {
            console.error("Hittade inget datasetId i payload:", body);
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