// Demo content for the shareable /demo dashboard. The real dashboard components
// (HeroBlock + VideoGrid) are reused as-is and fed this data, so the demo mirrors
// the real UI automatically as it evolves — only the content here is fictional.
//
// Metrics are spread deliberately so that different posts top the list depending
// on the chosen sort (one viral-but-shallow post, one small-but-high-ER post,
// share-heavy, comment-heavy, save-heavy, etc.). Numbers are rounded so they
// read clearly as illustrative demo data rather than real exact figures.

export interface DemoVideo {
  id: string;
  handle: string;
  video_url: string;
  thumbnail_url: string | null;
  published_at: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  collect_count: number | null;
  is_ad: boolean | null;
  engagement_rate: number | null;
  caption: string | null;
  is_excluded?: boolean | null;
}

const PALETTE = ["#C8962A", "#E8116A", "#2D6E7E", "#6A9A3B", "#96614A", "#4B6CB7", "#8A5A9E", "#117A5B"];

function thumb(i: number): string {
  const c = PALETTE[i % PALETTE.length];
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='375'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='${c}'/><stop offset='1' stop-color='#07253A'/></linearGradient></defs>` +
    `<rect width='300' height='375' fill='url(#g)'/>` +
    `<circle cx='150' cy='188' r='42' fill='rgba(255,255,255,0.16)'/>` +
    `<path d='M138 165 L138 211 L178 188 Z' fill='rgba(255,255,255,0.85)'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Weighted engagement rate — same formula as the DB column.
function er(views: number, likes: number, comments: number, shares: number, collect: number | null): number | null {
  if (views <= 0) return null;
  const num = likes + comments * 5 + (collect ?? 0) * 5 + shares * 10;
  return Math.round((num / views) * 100 * 10000) / 10000;
}

type Row = {
  v: number; l: number; c: number; s: number; col: number | null; ad: boolean; date: string; cap: string;
};

// [views, likes, comments, shares, collect, isAd, date, caption]
// Dates are grouped into ISO weeks of 3–5 posts each (W35–W40 2026) so the
// "per vecka" grouping shows several realistic buckets. Figures are rounded.
const ROWS: Row[] = [
  { v: 2_400_000, l: 58_000, c: 400, s: 4_000, col: 2_000, ad: false, date: "2026-08-24", cap: "När måndagen kommer för tidigt 😅 #humor" },
  { v: 8_000, l: 1_500, c: 400, s: 550, col: 1_000, ad: false, date: "2026-08-25", cap: "Liten video, stort engagemang — vår community är bäst" },
  { v: 320_000, l: 12_000, c: 200, s: 9_500, col: 2_000, ad: false, date: "2026-08-27", cap: "Dela med någon som behöver se det här 🔁" },
  { v: 180_000, l: 10_000, c: 4_500, s: 600, col: 550, ad: false, date: "2026-08-28", cap: "Vad tycker ni? Svara i kommentarerna 👇" },
  { v: 96_000, l: 31_000, c: 200, s: 400, col: 200, ad: false, date: "2026-08-30", cap: "Tack för all kärlek på den här ❤️" },
  { v: 140_000, l: 5_500, c: 150, s: 500, col: 9_000, ad: false, date: "2026-08-31", cap: "Spara den här till nästa gång du ska baka 🧁" },
  { v: 54_000, l: 2_000, c: 100, s: 200, col: 150, ad: true, date: "2026-09-02", cap: "Kampanj: höstens nyheter är här" },
  { v: 410_000, l: 18_000, c: 650, s: 1_500, col: 1_500, ad: true, date: "2026-09-04", cap: "Annons: prova själv — länk i bion" },
  { v: 23_000, l: 2_000, c: 250, s: 300, col: 450, ad: false, date: "2026-09-05", cap: "Behind the scenes från inspelningen" },
  { v: 67_000, l: 3_500, c: 100, s: 200, col: 300, ad: false, date: "2026-09-07", cap: "En helt vanlig dag på kontoret" },
  { v: 890_000, l: 24_000, c: 300, s: 1_500, col: 900, ad: false, date: "2026-09-09", cap: "Den här tog fart direkt 🚀" },
  { v: 13_000, l: 800, c: 60, s: 70, col: 100, ad: false, date: "2026-09-11", cap: "Snabb tips-tisdag" },
  { v: 210_000, l: 7_500, c: 3_000, s: 550, col: 600, ad: false, date: "2026-09-12", cap: "Diskussionen i kommentarerna blev het 🔥" },
  { v: 48_000, l: 7_000, c: 150, s: 200, col: 250, ad: false, date: "2026-09-14", cap: "Liten men fin räckvidd" },
  { v: 760_000, l: 15_000, c: 300, s: 5_000, col: 1_000, ad: false, date: "2026-09-16", cap: "Taggade en vän? Bra jobbat 🔁" },
  { v: 33_000, l: 2_500, c: 400, s: 250, col: 2_000, ad: false, date: "2026-09-18", cap: "Guide: steg för steg (spara!)" },
  { v: 130_000, l: 4_000, c: 90, s: 150, col: 200, ad: true, date: "2026-09-19", cap: "Sponsrat: i samarbete med X" },
  { v: 59_000, l: 3_000, c: 200, s: 350, col: 400, ad: false, date: "2026-09-21", cap: "Sommarminnen ☀️" },
  { v: 17_000, l: 2_500, c: 300, s: 400, col: 550, ad: false, date: "2026-09-23", cap: "Ni frågade — vi svarar" },
  { v: 1_200_000, l: 30_000, c: 400, s: 2_000, col: 1_500, ad: false, date: "2026-09-25", cap: "Trend vi inte kunde låta bli 💃" },
  { v: 41_000, l: 1_500, c: 90, s: 100, col: 150, ad: false, date: "2026-09-26", cap: "Kort och gott" },
  { v: 88_000, l: 6_000, c: 2_000, s: 300, col: 350, ad: false, date: "2026-09-28", cap: "Fråga oss vad som helst 👇" },
  { v: 27_000, l: 1_500, c: 70, s: 100, col: 3_000, ad: false, date: "2026-09-30", cap: "Checklista inför lanseringen (spara)" },
  { v: 310_000, l: 12_000, c: 250, s: 700, col: 650, ad: true, date: "2026-10-02", cap: "Kampanj: sista chansen den här veckan" },
];

export const DEMO_VIDEOS: DemoVideo[] = ROWS.map((r, i) => ({
  id: `demo-${i + 1}`,
  handle: "demokonto",
  video_url: "#",
  thumbnail_url: thumb(i),
  published_at: new Date(`${r.date}T12:00:00Z`).toISOString(),
  views: r.v,
  likes: r.l,
  comments: r.c,
  shares: r.s,
  collect_count: r.col,
  is_ad: r.ad,
  engagement_rate: er(r.v, r.l, r.c, r.s, r.col),
  caption: r.cap,
  is_excluded: false,
}));

// Follower sparkline + a positive delta, growing over ~8 weeks.
const FOLLOWER_HISTORY = [
  { date: "2026-08-11", followers: 40_200 },
  { date: "2026-08-18", followers: 41_050 },
  { date: "2026-08-25", followers: 41_900 },
  { date: "2026-09-01", followers: 43_100 },
  { date: "2026-09-08", followers: 44_300 },
  { date: "2026-09-15", followers: 45_900 },
  { date: "2026-09-22", followers: 47_600 },
  { date: "2026-10-01", followers: 49_400 },
];

const avatarSvg =
  `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'>` +
  `<rect width='128' height='128' rx='64' fill='#C8962A'/>` +
  `<text x='64' y='84' font-family='Arial, sans-serif' font-size='56' font-weight='bold' ` +
  `fill='#1C1B19' text-anchor='middle'>DK</text></svg>`;

export const DEMO_HERO = {
  handle: "demokonto",
  display_name: "Demokonto",
  avatar_url: `data:image/svg+xml;utf8,${encodeURIComponent(avatarSvg)}`,
  tracked_since: "2026-07-01T00:00:00Z",
  last_fetched_at: new Date().toISOString(),
  followers: {
    current: 49_400,
    history: FOLLOWER_HISTORY,
    delta: { abs: 9_200, pct: 22.9, meaningful: true, days: 56 },
    rounding_step: 100,
  },
  // Overridden client-side from the (filtered) videos, but filled for safety.
  benchmarks: {
    videos: DEMO_VIDEOS.length,
    posts_per_week: 4,
    total_views: 0, total_likes: 0, total_comments: 0, total_shares: 0, total_collects: 0,
    avg_views: 0, avg_likes: 0, avg_comments: 0, avg_shares: 0, avg_collects: 0, avg_er: 0,
  },
};
