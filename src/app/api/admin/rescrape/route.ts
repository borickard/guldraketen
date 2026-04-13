import { startScrapeForHandles, processScrapeResults } from "@/lib/scrape";
import { NextRequest, NextResponse } from "next/server";

// Allow up to 60 seconds — Apify typically finishes in 10–20s for 50 posts
export const maxDuration = 60;

const APIFY_API_BASE = "https://api.apify.com/v2";
const POLL_INTERVAL_MS = 3_000;
const MAX_WAIT_MS = 55_000; // stay within maxDuration

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { handle: rawHandle, postsBack = 50 } = body ?? {};

  if (!rawHandle)
    return NextResponse.json({ error: "handle krävs" }, { status: 400 });

  const handle = String(rawHandle).trim().replace(/^@/, "").toLowerCase();
  if (!handle)
    return NextResponse.json({ error: "Ogiltigt handle" }, { status: 400 });

  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken)
    return NextResponse.json({ error: "APIFY_TOKEN saknas" }, { status: 500 });

  // Start run without a webhook — we'll poll and process inline instead
  let runId: string;
  let scrapeRunId: string;
  try {
    const result = await startScrapeForHandles([handle], null, postsBack);
    runId = result.runId;
    scrapeRunId = result.scrapeRunId;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  // Poll Apify until SUCCEEDED (or FAILED/TIMED_OUT)
  const deadline = Date.now() + MAX_WAIT_MS;
  let datasetId: string | null = null;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    let statusRes: Response;
    try {
      statusRes = await fetch(`${APIFY_API_BASE}/actor-runs/${runId}`, {
        headers: { Authorization: `Bearer ${apifyToken}` },
      });
    } catch {
      continue; // network blip — retry
    }

    if (!statusRes.ok) continue;

    const statusData = await statusRes.json();
    const status: string = statusData?.data?.status ?? "";

    if (status === "SUCCEEDED") {
      datasetId = statusData?.data?.defaultDatasetId ?? null;
      break;
    }
    if (["FAILED", "TIMED_OUT", "ABORTED"].includes(status)) {
      return NextResponse.json(
        { error: `Apify-körning avslutades med status: ${status}` },
        { status: 500 }
      );
    }
    // RUNNING / READY / WAITING — keep polling
  }

  if (!datasetId) {
    return NextResponse.json(
      { error: "Apify-körningen tog för lång tid — kontrollera scrape-loggen manuellt" },
      { status: 504 }
    );
  }

  // Process results inline (no webhook needed)
  try {
    const result = await processScrapeResults(datasetId, runId);
    return NextResponse.json({ ok: true, ...result, runId, scrapeRunId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
