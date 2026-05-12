import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Daily follower snapshot for dashboard-linked handles only.
// Uses minimum resultsPerPage to keep Apify cost trivial — we just need
// authorMeta.fans, not the videos themselves.

export const maxDuration = 300;

const APIFY_ACTOR_ID = "clockworks~tiktok-profile-scraper";
const APIFY_API_BASE = "https://api.apify.com/v2";
const POLL_INTERVAL_MS = 3_000;
const MAX_WAIT_MS = 240_000;

export async function GET(req: NextRequest) {
  // Auth: Vercel Cron sends a Bearer header that matches CRON_SECRET
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    return NextResponse.json({ error: "APIFY_TOKEN saknas" }, { status: 500 });
  }

  // 1. Collect distinct handles linked to dashboard users.
  const { data: linkedRows, error: linkErr } = await supabaseAdmin
    .from("user_handles")
    .select("handle");
  if (linkErr) {
    return NextResponse.json({ error: linkErr.message }, { status: 500 });
  }
  const handles = Array.from(new Set((linkedRows ?? []).map((r) => r.handle).filter(Boolean)));
  if (handles.length === 0) {
    return NextResponse.json({ ok: true, handles: 0, message: "No dashboard handles linked." });
  }

  // 2. Kick off Apify run (resultsPerPage: 1 → 1 video per profile, enough to read authorMeta.fans).
  const runRes = await fetch(
    `${APIFY_API_BASE}/acts/${encodeURIComponent(APIFY_ACTOR_ID)}/runs`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apifyToken}` },
      body: JSON.stringify({
        profiles: handles,
        profileScrapeSections: ["videos"],
        profileSorting: "latest",
        resultsPerPage: 1,
        excludePinnedPosts: false,
      }),
    }
  );
  if (!runRes.ok) {
    return NextResponse.json({ error: `Apify start ${runRes.status}` }, { status: 502 });
  }
  const runJson = await runRes.json();
  const runId: string = runJson?.data?.id;
  if (!runId) {
    return NextResponse.json({ error: "Inget runId från Apify" }, { status: 502 });
  }

  // 3. Poll until SUCCEEDED.
  const deadline = Date.now() + MAX_WAIT_MS;
  let datasetId: string | null = null;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    let s: Response;
    try {
      s = await fetch(`${APIFY_API_BASE}/actor-runs/${runId}`, {
        headers: { Authorization: `Bearer ${apifyToken}` },
      });
    } catch {
      continue;
    }
    if (!s.ok) continue;
    const sJson = await s.json();
    const status: string = sJson?.data?.status ?? "";
    if (status === "SUCCEEDED") {
      datasetId = sJson?.data?.defaultDatasetId ?? null;
      break;
    }
    if (["FAILED", "TIMED_OUT", "TIMED-OUT", "ABORTED"].includes(status)) {
      return NextResponse.json({ error: `Apify status ${status}` }, { status: 502 });
    }
  }
  if (!datasetId) {
    return NextResponse.json({ error: "Apify-körningen tog för lång tid" }, { status: 504 });
  }

  // 4. Read dataset items, extract follower counts per handle.
  const dataRes = await fetch(
    `${APIFY_API_BASE}/datasets/${datasetId}/items?format=json&clean=true`,
    { headers: { Authorization: `Bearer ${apifyToken}` } }
  );
  if (!dataRes.ok) {
    return NextResponse.json({ error: "Kunde inte läsa dataset" }, { status: 502 });
  }
  const items = (await dataRes.json()) as Array<{
    authorMeta?: { name?: string; fans?: number };
  }>;

  const followerMap: Record<string, number> = {};
  for (const it of items) {
    const handle = it?.authorMeta?.name;
    const fans = it?.authorMeta?.fans;
    if (handle && typeof fans === "number" && !(handle in followerMap)) {
      followerMap[handle] = fans;
    }
  }

  // 5. Upsert today's snapshot.
  const today = new Date().toISOString().slice(0, 10);
  const rows = Object.entries(followerMap).map(([handle, followers]) => ({
    handle,
    captured_date: today,
    followers,
  }));

  if (rows.length > 0) {
    const { error: upErr } = await supabaseAdmin
      .from("follower_history")
      .upsert(rows, { onConflict: "handle,captured_date" });
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    // Also refresh accounts.followers + followers_updated_at for parity with weekly scrape
    for (const [handle, followers] of Object.entries(followerMap)) {
      await supabaseAdmin
        .from("accounts")
        .update({ followers, followers_updated_at: new Date().toISOString() })
        .eq("handle", handle);
    }
  }

  return NextResponse.json({
    ok: true,
    handles: handles.length,
    captured: rows.length,
    skipped: handles.length - rows.length,
  });
}
