import { processScrapeResults } from "@/lib/scrape";
import { NextResponse } from "next/server";

// Apify kallar på denna när scraping-jobbet är klart
export async function POST(req: Request) {
    try {
        const { datasetId } = await req.json();

        if (!datasetId) {
            return NextResponse.json({ error: "datasetId saknas" }, { status: 400 });
        }

        const result = await processScrapeResults(datasetId);
        return NextResponse.json(result);
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}