import { startScrape } from "@/lib/scrape";
import { NextRequest, NextResponse } from "next/server";

// Anropas från admin-UI – startar Apify asynkront och svarar direkt
export async function POST(req: NextRequest) {
    try {
        const origin = req.nextUrl.origin;
        const webhookUrl = `${origin}/api/scrape/webhook`;
        const result = await startScrape(webhookUrl);
        return NextResponse.json({
            message: "Scraping startad – data sparas automatiskt när Apify är klar.",
            ...result,
        });
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}