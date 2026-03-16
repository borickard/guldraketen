import { startScrape } from "@/lib/scrape";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const daysBack = typeof body.daysBack === "number" ? body.daysBack : 14;

        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
        const webhookUrl = `${baseUrl}/api/scrape/webhook`;

        const result = await startScrape(webhookUrl, daysBack);
        return NextResponse.json({ message: "Scraping startad", ...result });
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}