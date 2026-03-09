import { runScrape } from "@/lib/scrape";
import { NextResponse } from "next/server";

function isAuthorized(req: Request): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false;
    const authHeader = req.headers.get("authorization");
    return authHeader === `Bearer ${secret}`;
}

export async function POST(req: Request) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const result = await runScrape();
        return NextResponse.json(result);
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