import { startScrape } from "@/lib/scrape";
import { NextResponse } from "next/server";

function isAuthorized(req: Request): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false;
    return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req: Request) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://guldraketen.vercel.app";
        const webhookUrl = `${baseUrl}/api/scrape/webhook`;
        const result = await startScrape(webhookUrl, 14, "cron");
        return NextResponse.json({ message: "Scraping startad", ...result });
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}

// Vercel Cron anropar GET
export async function GET(req: Request) {
    return POST(req);
}