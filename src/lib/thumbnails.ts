import { supabaseAdmin } from "./supabaseAdmin";

const BUCKET = "thumbnails";

export function isStoredThumbnail(url: string): boolean {
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  return url.startsWith(supabaseUrl);
}

/** Upload a thumbnail from a remote URL to Supabase Storage.
 *  Returns the permanent public URL, or null if the upload failed. */
export async function uploadThumbnail(
  sourceUrl: string,
  videoUrl: string
): Promise<string | null> {
  try {
    // Derive a stable filename from the TikTok video ID
    const videoId = videoUrl.match(/\/video\/(\d+)/)?.[1] ?? videoUrl.replace(/\W/g, "");
    const path = `${videoId}.jpg`;

    const res = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") ?? "image/jpeg";

    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType, upsert: true });

    if (error) return null;

    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
}

/** Upload a profile avatar from a remote URL to Supabase Storage.
 *  Returns the permanent public URL, or null if the upload failed. */
export async function uploadAvatar(
  handle: string,
  sourceUrl: string
): Promise<string | null> {
  try {
    const path = `avatars/${handle}.jpg`;

    const res = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") ?? "image/jpeg";

    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType, upsert: true });

    if (error) return null;

    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
}

/** Upload thumbnails for an array of video rows concurrently (max 5 at a time).
 *  Mutates each row's thumbnail_url in place if upload succeeds. */
export async function uploadThumbnailsBatch(
  rows: Array<{ video_url: string; thumbnail_url: string | null }>
): Promise<void> {
  const CONCURRENCY = 5;

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (row) => {
        if (!row.thumbnail_url || isStoredThumbnail(row.thumbnail_url)) return;
        const stored = await uploadThumbnail(row.thumbnail_url, row.video_url);
        if (stored) row.thumbnail_url = stored;
      })
    );
  }
}
