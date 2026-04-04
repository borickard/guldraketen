import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

// ── Point values — adjust here ────────────────────────────────────────────────
const POINTS: Record<number, number> = { 1: 15, 2: 10, 3: 5 };
const MIN_ACCOUNTS_PER_WEEK = 5;
const MIN_VIDEO_VIEWS = 10_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function toISOWeek(date: Date): string {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const week1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const weekNum =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getUTCDay() + 6) % 7)) /
        7
    );
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function currentAndPreviousWeek(): [string, string] {
  const now = new Date();
  const curr = toISOWeek(now);
  const prev = toISOWeek(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  return [curr, prev];
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET() {
  // Fetch all videos (all time — can add cutoff later if needed)
  const { data, error } = await supabaseAdmin
    .from("videos")
    .select("handle, views, engagement_rate, published_at, accounts(display_name)")
    .not("published_at", "is", null)
    .or("is_contest.eq.false,contest_approved.eq.true")
    .order("published_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const [currentWeek, previousWeek] = currentAndPreviousWeek();

  // Group videos by ISO week
  const byWeek = new Map<string, typeof data>();
  for (const v of data ?? []) {
    const week = toISOWeek(new Date(v.published_at!));
    if (week === currentWeek || week === previousWeek) continue;
    const list = byWeek.get(week) ?? [];
    list.push(v);
    byWeek.set(week, list);
  }

  // Accumulate scores
  const scores = new Map<string, {
    displayName: string;
    totalPoints: number;
    gold: number;
    silver: number;
    bronze: number;
  }>();

  for (const [, videos] of byWeek) {
    // Group by account, keep only videos with enough views
    const byAccount = new Map<string, { engagement_rate: number; displayName: string }[]>();
    for (const v of videos) {
      if ((v.views ?? 0) < MIN_VIDEO_VIEWS) continue;
      const acct = Array.isArray(v.accounts) ? v.accounts[0] : v.accounts;
      const displayName = acct?.display_name ?? `@${v.handle}`;
      const list = byAccount.get(v.handle) ?? [];
      list.push({ engagement_rate: v.engagement_rate ?? 0, displayName });
      byAccount.set(v.handle, list);
    }

    if (byAccount.size < MIN_ACCOUNTS_PER_WEEK) continue;

    // Rank accounts by best engagement_rate
    const ranked = [...byAccount.entries()]
      .map(([handle, vids]) => ({
        handle,
        displayName: vids[0].displayName,
        bestRate: Math.max(...vids.map((v) => v.engagement_rate)),
      }))
      .sort((a, b) => b.bestRate - a.bestRate);

    // Award points to top 3
    for (let i = 0; i < Math.min(3, ranked.length); i++) {
      const rank = i + 1;
      if (!POINTS[rank]) continue;
      const { handle, displayName } = ranked[i];
      const entry = scores.get(handle) ?? { displayName, totalPoints: 0, gold: 0, silver: 0, bronze: 0 };
      entry.totalPoints += POINTS[rank];
      if (rank === 1) entry.gold++;
      if (rank === 2) entry.silver++;
      if (rank === 3) entry.bronze++;
      scores.set(handle, entry);
    }
  }

  const result = [...scores.entries()]
    .map(([handle, s]) => ({ handle, ...s }))
    .sort((a, b) => b.totalPoints - a.totalPoints || b.gold - a.gold);

  const res = NextResponse.json(result);
  res.headers.set("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  return res;
}
