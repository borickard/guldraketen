import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { uploadAvatar, isStoredThumbnail } from "@/lib/thumbnails";
import { NextResponse } from "next/server";

const APIFY_ACTOR_ID = "clockworks~tiktok-profile-scraper";
const APIFY_API_BASE = "https://api.apify.com/v2";

function extractAvatarUrl(item: Record<string, unknown>): string | null {
  // Try every known field name/path the Apify actor uses
  const am = (item?.authorMeta ?? {}) as Record<string, unknown>;
  const au = (item?.author ?? {}) as Record<string, unknown>;

  return (
    (am.avatar as string) ||
    (am.avatarUrl as string) ||
    (am.avatarLarger as string) ||
    (am.avatarMedium as string) ||
    (am.avatarThumb as string) ||
    (au.avatarThumb as string) ||
    (au.avatarLarger as string) ||
    (item.avatarThumb as string) ||
    (item.avatarLarger as string) ||
    null
  );
}

export async function POST() {
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    return NextResponse.json({ error: "APIFY_TOKEN saknas" }, { status: 500 });
  }

  // Fetch all active accounts
  const { data: accounts, error: accErr } = await supabaseAdmin
    .from("accounts")
    .select("handle, avatar_url")
    .eq("is_active", true);

  if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 });

  const handles = (accounts ?? []).map((a) => a.handle);
  if (handles.length === 0) return NextResponse.json({ error: "Inga aktiva konton" }, { status: 400 });

  // Run Apify synchronously (waitSecs=120), 1 item per profile — just enough to get authorMeta
  const url =
    `${APIFY_API_BASE}/acts/${encodeURIComponent(APIFY_ACTOR_ID)}/run-sync-get-dataset-items` +
    `?token=${apifyToken}&waitSecs=120`;

  const apifyRes = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profiles: handles,
      profileScrapeSections: ["videos"],
      profileSorting: "latest",
      resultsPerPage: 1,
    }),
  });

  if (!apifyRes.ok) {
    const text = await apifyRes.text();
    return NextResponse.json({ error: `Apify fel ${apifyRes.status}: ${text}` }, { status: 502 });
  }

  const items: Array<Record<string, unknown>> = await apifyRes.json();

  // Build handle → avatar map (first found per handle wins)
  const avatarMap: Record<string, string> = {};
  for (const item of items) {
    const handle =
      (item?.authorMeta as Record<string, unknown>)?.name as string ||
      (item?.author as Record<string, unknown>)?.uniqueId as string ||
      item?.authorUniqueId as string ||
      "";
    if (!handle || handle in avatarMap) continue;
    const avatarUrl = extractAvatarUrl(item);
    if (avatarUrl) avatarMap[handle] = avatarUrl;
  }

  // Upload + save
  let saved = 0;
  let failed = 0;
  const debug: Record<string, string> = {};

  for (const [handle, rawUrl] of Object.entries(avatarMap)) {
    const stored = isStoredThumbnail(rawUrl) ? rawUrl : await uploadAvatar(handle, rawUrl);
    if (stored) {
      const { error } = await supabaseAdmin
        .from("accounts")
        .update({ avatar_url: stored })
        .eq("handle", handle);
      if (error) { failed++; debug[handle] = `db-error: ${error.message}`; }
      else { saved++; debug[handle] = "ok"; }
    } else {
      failed++;
      debug[handle] = `upload-failed: ${rawUrl.slice(0, 80)}`;
    }
  }

  return NextResponse.json({
    handles: handles.length,
    items_returned: items.length,
    avatars_found: Object.keys(avatarMap).length,
    saved,
    failed,
    debug,
  });
}
