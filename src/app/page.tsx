"use client";

import { useEffect, useState, useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Video {
  id: string;
  handle: string;
  video_url: string;
  published_at: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
  last_updated: string;
  accounts: { followers: number } | null;
}

type SortKey = "engagement_rate" | "likes" | "comments" | "shares" | "views";
type SizeFilter = "all" | "small" | "medium" | "large";

function accountSize(followers: number): SizeFilter {
  if (followers < 10_000) return "small";
  if (followers < 100_000) return "medium";
  return "large";
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function tiktokEmbedId(url: string): string | null {
  const m = url.match(/\/video\/(\d+)/);
  return m ? m[1] : null;
}

// ─── VideoCard ────────────────────────────────────────────────────────────────

function VideoCard({ video, rank, highlight }: { video: Video; rank: number; highlight: SortKey }) {
  const [expanded, setExpanded] = useState(false);
  const embedId = tiktokEmbedId(video.video_url);
  const followers = video.accounts?.followers ?? 0;
  const size = accountSize(followers);
  const sizeLabel = { small: "< 10K", medium: "10K–100K", large: "> 100K", all: "" }[size];

  const rankDisplay = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : String(rank).padStart(2, "0");

  const stats: { key: SortKey; label: string; value: string }[] = [
    { key: "engagement_rate", label: "Eng.rate", value: video.engagement_rate != null ? video.engagement_rate.toFixed(2) + "%" : "–" },
    { key: "views", label: "Views", value: fmt(video.views ?? 0) },
    { key: "likes", label: "Likes", value: fmt(video.likes ?? 0) },
    { key: "comments", label: "Kommentarer", value: fmt(video.comments ?? 0) },
    { key: "shares", label: "Delningar", value: fmt(video.shares ?? 0) },
  ];

  return (
    <article className={`card rank-${Math.min(rank, 4)}`}>
      <div className="card-inner">
        <div className="rank-col">
          <span className="rank">{rankDisplay}</span>
        </div>

        <div className="thumb-col">
          <button className="thumb-btn" onClick={() => setExpanded(!expanded)} aria-label={expanded ? "Stäng" : "Visa video"}>
            {expanded && embedId ? (
              <div className="embed-wrap">
                <iframe
                  src={`https://www.tiktok.com/embed/v2/${embedId}`}
                  className="embed-iframe"
                  allowFullScreen
                  allow="autoplay"
                  scrolling="no"
                />
              </div>
            ) : (
              <div className="thumb">
                <span className="play">▶</span>
              </div>
            )}
          </button>
        </div>

        <div className="meta-col">
          <div className="account-row">
            <a className="handle" href={`https://www.tiktok.com/@${video.handle}`} target="_blank" rel="noopener noreferrer">
              @{video.handle}
            </a>
            <span className="tag">{sizeLabel} följare</span>
            <span className="date">{new Date(video.published_at).toLocaleDateString("sv-SE")}</span>
          </div>

          <div className="stats-row">
            {stats.map((s) => (
              <div key={s.key} className={`stat ${highlight === s.key ? "stat--active" : ""}`}>
                <span className="stat-label">{s.label}</span>
                <span className="stat-value">{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        <a className="ext-link" href={video.video_url} target="_blank" rel="noopener noreferrer" aria-label="Öppna på TikTok">↗</a>
      </div>
    </article>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "engagement_rate", label: "Engagemangsrate" },
  { key: "views", label: "Views" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Kommentarer" },
  { key: "shares", label: "Delningar" },
];

const SIZE_OPTIONS: { key: SizeFilter; label: string }[] = [
  { key: "all", label: "Alla" },
  { key: "small", label: "< 10K" },
  { key: "medium", label: "10K–100K" },
  { key: "large", label: "> 100K" },
];

export default function HomePage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortKey>("engagement_rate");
  const [size, setSize] = useState<SizeFilter>("all");

  useEffect(() => {
    fetch("/api/videos")
      .then((r) => r.json())
      .then((d) => { setVideos(d); setLoading(false); })
      .catch(() => { setError("Kunde inte ladda videos."); setLoading(false); });
  }, []);

  const sorted = useMemo(() => {
    return [...videos]
      .filter((v) => size === "all" || accountSize(v.accounts?.followers ?? 0) === size)
      .sort((a, b) => (b[sort] ?? 0) - (a[sort] ?? 0));
  }, [videos, sort, size]);

  return (
    <>
      <style>{css}</style>
      <main className="root">
        <header className="header">
          <p className="eyebrow">Sverige · TikTok · 2024</p>
          <h1 className="title">Guldraketen</h1>
          <p className="sub">Rangordnat efter faktiskt publikengagemang.</p>
        </header>

        <div className="controls">
          <div className="control-group">
            <span className="control-label">Sortera</span>
            <div className="pills">
              {SORT_OPTIONS.map((o) => (
                <button key={o.key} className={`pill ${sort === o.key ? "pill--on" : ""}`} onClick={() => setSort(o.key)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="control-group">
            <span className="control-label">Följare</span>
            <div className="pills">
              {SIZE_OPTIONS.map((o) => (
                <button key={o.key} className={`pill ${size === o.key ? "pill--on" : ""}`} onClick={() => setSize(o.key)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading && <p className="state-msg">Laddar…</p>}
        {error && <p className="state-msg state-msg--err">{error}</p>}
        {!loading && !error && sorted.length === 0 && <p className="state-msg">Inga videos matchar filtret.</p>}

        <div className="list">
          {sorted.map((v, i) => (
            <VideoCard key={v.id} video={v} rank={i + 1} highlight={sort} />
          ))}
        </div>

        <footer className="footer">© {new Date().getFullYear()} Guldraketen</footer>
      </main>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500&display=swap');

  :root {
    --bg:      #0c0b09;
    --bg2:     #141210;
    --bg3:     #1e1b16;
    --gold:    #d4a840;
    --golddim: #8a6c28;
    --text:    #e8e2d6;
    --muted:   #7a7060;
    --border:  #2a2520;
    --r:       6px;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .root {
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    font-family: 'Inter', sans-serif;
    max-width: 860px;
    margin: 0 auto;
    padding: 0 1.25rem 5rem;
  }

  /* Header */
  .header { padding: 4rem 0 2.5rem; border-bottom: 1px solid var(--border); margin-bottom: 2rem; }
  .eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: .65rem; letter-spacing: .18em; text-transform: uppercase; color: var(--gold); margin-bottom: .75rem; }
  .title { font-family: 'Playfair Display', serif; font-size: clamp(2.8rem, 8vw, 5rem); font-weight: 900; line-height: .95; letter-spacing: -.02em; margin-bottom: 1rem; }
  .sub { font-size: .9rem; color: var(--muted); }

  /* Controls */
  .controls { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--r); padding: 1.25rem; margin-bottom: 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
  .control-group { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; }
  .control-label { font-family: 'IBM Plex Mono', monospace; font-size: .62rem; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); min-width: 5rem; flex-shrink: 0; }
  .pills { display: flex; flex-wrap: wrap; gap: .35rem; }
  .pill { background: transparent; border: 1px solid var(--border); color: var(--muted); border-radius: 999px; padding: .28rem .8rem; font-size: .75rem; cursor: pointer; transition: all .15s; font-family: 'Inter', sans-serif; }
  .pill:hover { border-color: var(--golddim); color: var(--text); }
  .pill--on { background: var(--gold); border-color: var(--gold); color: #0c0b09; font-weight: 600; }

  /* State */
  .state-msg { color: var(--muted); font-size: .85rem; padding: 2rem 0; font-family: 'IBM Plex Mono', monospace; }
  .state-msg--err { color: #e07060; }

  /* List */
  .list { display: flex; flex-direction: column; gap: .5rem; }

  /* Card */
  .card { border: 1px solid var(--border); border-radius: var(--r); background: var(--bg2); transition: border-color .15s; }
  .card:hover { border-color: var(--golddim); }
  .rank-1 { border-left: 3px solid var(--gold); }
  .rank-2 { border-left: 3px solid #a0a0a0; }
  .rank-3 { border-left: 3px solid #8a6540; }

  .card-inner { display: flex; align-items: flex-start; gap: .85rem; padding: .9rem 1rem; }

  .rank-col { flex-shrink: 0; width: 2.2rem; padding-top: .15rem; }
  .rank { font-family: 'Playfair Display', serif; font-size: 1.3rem; font-weight: 700; color: var(--gold); line-height: 1; }

  /* Thumb */
  .thumb-col { flex-shrink: 0; }
  .thumb-btn { background: none; border: none; cursor: pointer; padding: 0; }
  .thumb { width: 52px; height: 92px; border-radius: 4px; background: var(--bg3); display: flex; align-items: center; justify-content: center; }
  .play { color: var(--muted); font-size: .9rem; transition: color .15s; }
  .thumb-btn:hover .play { color: var(--gold); }
  .embed-wrap { width: 260px; height: 460px; border-radius: 4px; overflow: hidden; background: #000; }
  .embed-iframe { width: 100%; height: 100%; border: none; }

  /* Meta */
  .meta-col { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .7rem; }
  .account-row { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; }
  .handle { font-family: 'IBM Plex Mono', monospace; font-size: .82rem; font-weight: 500; color: var(--text); text-decoration: none; transition: color .12s; }
  .handle:hover { color: var(--gold); }
  .tag { font-size: .62rem; padding: .12rem .5rem; border-radius: 999px; border: 1px solid var(--border); color: var(--muted); }
  .date { font-size: .65rem; color: var(--muted); font-family: 'IBM Plex Mono', monospace; }

  .stats-row { display: flex; flex-wrap: wrap; gap: .35rem; }
  .stat { display: flex; flex-direction: column; gap: .08rem; padding: .3rem .6rem; background: var(--bg3); border: 1px solid var(--border); border-radius: 4px; min-width: 4.2rem; transition: border-color .12s; }
  .stat--active { border-color: var(--golddim); background: #1c1810; }
  .stat-label { font-size: .58rem; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); font-family: 'IBM Plex Mono', monospace; }
  .stat-value { font-family: 'IBM Plex Mono', monospace; font-size: .85rem; font-weight: 500; color: var(--text); }
  .stat--active .stat-value { color: var(--gold); }

  .ext-link { color: var(--muted); text-decoration: none; font-size: .95rem; padding: .2rem; flex-shrink: 0; transition: color .12s; }
  .ext-link:hover { color: var(--gold); }

  .footer { margin-top: 4rem; font-size: .75rem; color: var(--muted); font-family: 'IBM Plex Mono', monospace; }

  @media (max-width: 580px) {
    .card-inner { flex-wrap: wrap; }
    .embed-wrap { width: 100%; }
    .control-label { min-width: auto; width: 100%; }
  }
`;