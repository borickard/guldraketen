import { startScrapeForHandles } from "@/lib/scrape";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { handle: rawHandle, postsBack = 50 } = body ?? {};

  if (!rawHandle)
    return NextResponse.json({ error: "handle krävs" }, { status: 400 });

  const handle = String(rawHandle).trim().replace(/^@/, "").toLowerCase();
  if (!handle)
    return NextResponse.json({ error: "Ogiltigt handle" }, { status: 400 });

  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
    const webhookUrl = `${baseUrl}/api/scrape/webhook`;
    const result = await startScrapeForHandles([handle], webhookUrl, postsBack);
    return NextResponse.json({ ok: true, runId: result.runId, scrapeRunId: result.scrapeRunId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
