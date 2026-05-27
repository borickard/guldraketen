import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

const MIN_VIDEO_VIEWS = 10_000;
const MIN_ACCOUNTS_PER_WEEK = 5;
const MIN_PUBLISHED_DATE = "2026-01-01T00:00:00Z"; // exclude legacy/test data
const TOP_N_PER_GROUP: Record<Scope, number> = { week: 20, month: 30, all: 100 };

type Scope = "week" | "month" | "all";
type SortKey = "er" | "likes" | "comments" | "shares" | "views" | "collects" | "newest";
type Filter = "all" | "organic" | "boosted";

const SORT_COLUMN: Record<SortKey, string> = {
  er: "engagement_rate",
  likes: "likes",
  comments: "comments",
  shares: "shares",
  views: "views",
  collects: "collect_count",
  newest: "published_at",
};

const MONTH_NAMES_SV = ["januari","februari","mars","april","maj","juni","juli","augusti","september","oktober","november","december"];

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

function toMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [yr, mo] = key.split("-").map(Number);
  return `${MONTH_NAMES_SV[mo - 1][0].toUpperCase()}${MONTH_NAMES_SV[mo - 1].slice(1)} ${yr}`;
}

function weekLabel(week: string): string {
  const m = week.match(/(\d{4})-W(\d{2})/);
  return m ? `V${parseInt(m[2])} ${m[1]}` : week;
}

function currentAndPreviousWeek(): [string, string] {
  const now = new Date();
  const curr = toISOWeek(now);
  const prev = toISOWeek(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  return [curr, prev];
}

export type HofVideo = {
  rank: number;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  category: string | null;
  video: {
    video_url: string;
    thumbnail_url: string | null;
    caption: string | null;
    published_at: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    collect_count: number | null;
    is_ad: boolean | null;
    engagement_rate: number;
  };
};

export type HofGroup = {
  key: string;
  label: string;
  videos: HofVideo[];
};

// Legacy alias kept so other code that imports HofWeek doesn't break.
export type HofWeek = HofGroup & { week: string };

type RawVideo = {
  handle: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  collect_count: number | null;
  is_ad: boolean | null;
  engagement_rate: number | null;
  published_at: string;
  thumbnail_url: string | null;
  caption: string | null;
  video_url: string;
  accounts: { display_name?: string | null; category?: string | null; avatar_url?: string | null } | { display_name?: string | null; category?: string | null; avatar_url?: string | null }[] | null;
};

function toHofVideo(v: RawVideo, rank: number): HofVideo {
  const acct = Array.isArray(v.accounts) ? v.accounts[0] : v.accounts;
  return {
    rank,
    handle: v.handle,
    displayName: acct?.display_name ?? `@${v.handle}`,
    avatarUrl: acct?.avatar_url ?? null,
    category: acct?.category ?? null,
    video: {
      video_url: v.video_url,
      thumbnail_url: v.thumbnail_url,
      caption: v.caption,
      published_at: v.published_at,
      views: v.views ?? 0,
      likes: v.likes ?? 0,
      comments: v.comments ?? 0,
      shares: v.shares ?? 0,
      collect_count: v.collect_count,
      is_ad: v.is_ad,
      engagement_rate: Number(v.engagement_rate ?? 0),
    },
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoryFilter = searchParams.get("category") ?? "";
  const scope = (searchParams.get("scope") ?? "week") as Scope;
  const sort = (searchParams.get("sort") ?? "er") as SortKey;
  const filter = (searchParams.get("filter") ?? "all") as Filter;

  if (!["week", "month", "all"].includes(scope)) {
    return NextResponse.json({ error: "Ogiltigt scope" }, { status: 400 });
  }
  if (!Object.prototype.hasOwnProperty.call(SORT_COLUMN, sort)) {
    return NextResponse.json({ error: "Ogiltigt sort" }, { status: 400 });
  }
  if (!["all", "organic", "boosted"].includes(filter)) {
    return NextResponse.json({ error: "Ogiltigt filter" }, { status: 400 });
  }

  const sortCol = SORT_COLUMN[sort];

  let query = supabaseAdmin
    .from("videos")
    .select(
      "handle, views, likes, comments, shares, collect_count, is_ad, engagement_rate, published_at, thumbnail_url, caption, video_url, accounts(display_name, category, avatar_url)"
    )
    .not("published_at", "is", null)
    .gte("published_at", MIN_PUBLISHED_DATE)
    .or("is_contest.eq.false,contest_approved.eq.true")
    .gte("views", MIN_VIDEO_VIEWS)
    .not(sortCol, "is", null)
    .order(sortCol, { ascending: false, nullsFirst: false });

  if (filter === "organic") {
    query = query.eq("is_ad", false);
  } else if (filter === "boosted") {
    query = query.eq("is_ad", true);
  }

  if (categoryFilter) {
    const { data: acctHandles } = await supabaseAdmin
      .from("accounts")
      .select("handle")
      .eq("category", categoryFilter);
    const handles = (acctHandles ?? []).map((a) => a.handle);
    if (handles.length === 0) return NextResponse.json([]);
    query = query.in("handle", handles);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const [currentWeek, previousWeek] = currentAndPreviousWeek();
  const videos = (data ?? []) as RawVideo[];

  // Always strip current + previous ISO week — same rule as before.
  const eligible = videos.filter((v) => {
    const wk = toISOWeek(new Date(v.published_at));
    return wk !== currentWeek && wk !== previousWeek;
  });

  const topN = TOP_N_PER_GROUP[scope];
  let groups: HofGroup[];

  if (scope === "all") {
    groups = [
      {
        key: "all",
        label: "Alla videor",
        videos: eligible.slice(0, topN).map((v, i) => toHofVideo(v, i + 1)),
      },
    ];
  } else if (scope === "month") {
    const byMonth = new Map<string, RawVideo[]>();
    for (const v of eligible) {
      const month = toMonthKey(new Date(v.published_at));
      const list = byMonth.get(month) ?? [];
      list.push(v);
      byMonth.set(month, list);
    }
    groups = [...byMonth.entries()]
      .sort(([a], [b]) => (b > a ? 1 : -1))
      .map(([key, rows]) => ({
        key,
        label: monthLabel(key),
        videos: rows.slice(0, topN).map((v, i) => toHofVideo(v, i + 1)),
      }));
  } else {
    const byWeek = new Map<string, RawVideo[]>();
    for (const v of eligible) {
      const wk = toISOWeek(new Date(v.published_at));
      const list = byWeek.get(wk) ?? [];
      list.push(v);
      byWeek.set(wk, list);
    }
    groups = [...byWeek.entries()]
      .filter(([, rows]) => {
        if (categoryFilter || filter !== "all") return true;
        return new Set(rows.map((r) => r.handle)).size >= MIN_ACCOUNTS_PER_WEEK;
      })
      .sort(([a], [b]) => (b > a ? 1 : -1))
      .map(([key, rows]) => ({
        key,
        label: weekLabel(key),
        videos: rows.slice(0, topN).map((v, i) => toHofVideo(v, i + 1)),
      }));
  }

  const res = NextResponse.json(groups);
  res.headers.set("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  return res;
}
