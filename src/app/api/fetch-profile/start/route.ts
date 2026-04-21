import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const APIFY_ACTOR_ID = "clockworks~tiktok-profile-scraper";
const APIFY_API_BASE = "https://api.apify.com/v2";
const CACHE_MS = 12 * 60 * 60 * 1000; // 12 hours

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { handle } = body ?? {};

  if (!handle) {
    return NextResponse.json({ error: "handle krävs" }, { status: 400 });
  }

  // 1. Cache check: recent scan of this handle
  const { data: cached } = await supabaseAdmin
    .from("profile_scans")
    .select("videos, scanned_at")
    .eq("handle", handle)
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached && cached.videos) {
    const age = Date.now() - new Date(cached.scanned_at).getTime();
    if (age <= CACHE_MS) {
      return NextResponse.json({
        source: "db",
        videos: cached.videos,
        scannedAt: cached.scanned_at,
      });
    }
  }

  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    return NextResponse.json({ error: "APIFY_TOKEN saknas" }, { status: 500 });
  }

  let apifyRes: Response;
  try {
    apifyRes = await fetch(
      `${APIFY_API_BASE}/acts/${encodeURIComponent(APIFY_ACTOR_ID)}/runs`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apifyToken}`,
        },
        body: JSON.stringify({
          profiles: [`@${handle}`],
          profileScrapeSections: ["videos"],
          profileSorting: "latest",
          resultsPerPage: 20,
        }),
      }
    );
  } catch (err) {
    return NextResponse.json({ error: `Nätverksfel mot Apify: ${err}` }, { status: 502 });
  }

  if (!apifyRes.ok) {
    const text = await apifyRes.text();
    return NextResponse.json({ error: `Apify error ${apifyRes.status}: ${text}` }, { status: 502 });
  }

  const json = await apifyRes.json();
  const runId: string = json?.data?.id;

  if (!runId) {
    return NextResponse.json({ error: "Inget runId från Apify" }, { status: 502 });
  }

  return NextResponse.json({ source: "apify", runId, handle });
}
