// Demo content for the shareable /demo dashboard. The real dashboard components
// (HeroBlock + VideoGrid) are reused as-is and fed this data, so the demo mirrors
// the real UI automatically as it evolves — only the content here is fictional.
//
// Metrics are spread deliberately so that different posts top the list depending
// on the chosen sort (one viral-but-shallow post, one small-but-high-ER post,
// share-heavy, comment-heavy, save-heavy, etc.). Dates span a few months so the
// "per vecka" / "per månad" grouping shows several buckets.

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
    `<text x='150' y='205' font-family='Arial, sans-serif' font-size='150' font-weight='bold' ` +
    `fill='rgba(255,255,255,0.22)' text-anchor='middle'>${i + 1}</text></svg>`;
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
const ROWS: Row[] = [
  { v: 2_410_000, l: 58_000, c: 420, s: 3_900, col: 2_100, ad: false, date: "2026-09-28", cap: "När måndagen kommer för tidigt 😅 #humor" },
  { v: 7_800,     l: 1_450,  c: 390, s: 540,   col: 980,   ad: false, date: "2026-10-01", cap: "Liten video, stort engagemang — vår community är bäst" },
  { v: 320_000,   l: 12_400, c: 210, s: 9_600, col: 1_800, ad: false, date: "2026-09-12", cap: "Dela med någon som behöver se det här 🔁" },
  { v: 184_000,   l: 9_800,  c: 4_300, s: 620, col: 540,   ad: false, date: "2026-08-30", cap: "Vad tycker ni? Svara i kommentarerna 👇" },
  { v: 96_000,    l: 31_000, c: 180,  s: 410,  col: 220,   ad: false, date: "2026-09-20", cap: "Tack för all kärlek på den här ❤️" },
  { v: 142_000,   l: 5_600,  c: 150,  s: 480,  col: 8_900, ad: false, date: "2026-07-18", cap: "Spara den här till nästa gång du ska baka 🧁" },
  { v: 54_000,    l: 2_100,  c: 95,   s: 180,  col: 160,   ad: true,  date: "2026-09-05", cap: "Kampanj: höstens nyheter är här" },
  { v: 410_000,   l: 18_200, c: 640,  s: 1_250, col: 1_400, ad: true, date: "2026-08-14", cap: "Annons: prova själv — länk i bion" },
  { v: 23_000,    l: 1_900,  c: 240,  s: 310,  col: 450,   ad: false, date: "2026-10-03", cap: "Behind the scenes från inspelningen" },
  { v: 67_000,    l: 3_400,  c: 120,  s: 220,  col: 300,   ad: false, date: "2026-09-25", cap: "En helt vanlig dag på kontoret" },
  { v: 890_000,   l: 24_000, c: 310,  s: 1_600, col: 900,  ad: false, date: "2026-07-02", cap: "Den här tog fart direkt 🚀" },
  { v: 12_500,    l: 820,    c: 60,   s: 70,   col: 110,   ad: false, date: "2026-08-08", cap: "Snabb tips-tisdag" },
  { v: 205_000,   l: 7_300,  c: 2_900, s: 540, col: 620,   ad: false, date: "2026-09-02", cap: "Diskussionen i kommentarerna blev het 🔥" },
  { v: 48_000,    l: 6_900,  c: 130,  s: 190,  col: 240,   ad: false, date: "2026-08-22", cap: "Liten men fin räckvidd" },
  { v: 760_000,   l: 15_000, c: 280,  s: 5_200, col: 1_100, ad: false, date: "2026-09-16", cap: "Taggade en vän? Bra jobbat 🔁" },
  { v: 33_000,    l: 2_600,  c: 410,  s: 260,  col: 1_900, ad: false, date: "2026-10-05", cap: "Guide: steg för steg (spara!)" },
  { v: 128_000,   l: 4_100,  c: 90,   s: 150,  col: 200,   ad: true,  date: "2026-07-28", cap: "Sponsrat: i samarbete med X" },
  { v: 59_000,    l: 3_050,  c: 175,  s: 330,  col: 410,   ad: false, date: "2026-08-02", cap: "Sommarminnen ☀️" },
  { v: 17_200,    l: 2_300,  c: 310,  s: 420,  col: 560,   ad: false, date: "2026-09-29", cap: "Ni frågade — vi svarar" },
  { v: 1_150_000, l: 29_500, c: 390,  s: 2_100, col: 1_300, ad: false, date: "2026-08-19", cap: "Trend vi inte kunde låta bli 💃" },
  { v: 41_000,    l: 1_700,  c: 85,   s: 120,  col: 150,   ad: false, date: "2026-07-11", cap: "Kort och gott" },
  { v: 88_000,    l: 5_900,  c: 2_050, s: 300, col: 330,   ad: false, date: "2026-09-08", cap: "Fråga oss vad som helst 👇" },
  { v: 26_500,    l: 1_250,  c: 70,   s: 95,   col: 3_200, ad: false, date: "2026-08-26", cap: "Checklista inför lanseringen (spara)" },
  { v: 305_000,   l: 11_800, c: 260,  s: 700,  col: 640,   ad: true,  date: "2026-10-02", cap: "Kampanj: sista chansen den här veckan" },
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
    posts_per_week: 2,
    total_views: 0, total_likes: 0, total_comments: 0, total_shares: 0, total_collects: 0,
    avg_views: 0, avg_likes: 0, avg_comments: 0, avg_shares: 0, avg_collects: 0, avg_er: 0,
  },
};
