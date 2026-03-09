import { runScrape } from "@/lib/scrape";
import { NextResponse } from "next/server";

// Trigger-routen anropas från admin-sidan i browsern.
// Den importerar scrape-logiken direkt – inget HTTP-anrop till sig själv.
export async function POST() {
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