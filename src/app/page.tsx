"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";

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
  thumbnail_url: string | null;
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

  const medalColors = ["#C8962A", "#8C9198", "#A0623A"];
  const rankBg = rank <= 3 ? medalColors[rank - 1] : "transparent";
  const rankBorder = rank > 3 ? "2px solid #e2ddd6" : "2px solid transparent";
  const rankColor = rank <= 3 ? "#fff" : "#8a8278";

  const stats: { key: SortKey; label: string; value: string }[] = [
    { key: "engagement_rate", label: "Eng.rate", value: video.engagement_rate != null ? video.engagement_rate.toFixed(2) + "%" : "–" },
    { key: "views", label: "Views", value: fmt(video.views ?? 0) },
    { key: "likes", label: "Likes", value: fmt(video.likes ?? 0) },
    { key: "comments", label: "Kommentarer", value: fmt(video.comments ?? 0) },
    { key: "shares", label: "Delningar", value: fmt(video.shares ?? 0) },
  ];

  return (
    <article className="card">
      {/* Rank */}
      <div className="rank-stripe" style={{ background: rankBg, border: rankBorder }}>
        <span className="rank-num" style={{ color: rankColor }}>{rank}</span>
      </div>

      {/* Thumbnail */}
      <button className="thumb-btn" onClick={() => setExpanded(!expanded)} aria-label={expanded ? "Stäng video" : "Visa video"}>
        {expanded && embedId ? (
          <div className="embed-wrap">
            <iframe src={`https://www.tiktok.com/embed/v2/${embedId}`} className="embed-iframe" allowFullScreen allow="autoplay" scrolling="no" />
          </div>
        ) : (
          <div className="thumb">
            {video.thumbnail_url ? (
                <Image
                  src={video.thumbnail_url}
                  alt={`@${video.handle}`}
                  fill
                  sizes="72px"
                  style={{ objectFit: "cover" }}
                />
            ) : (
              <span className="thumb-placeholder">▶</span>
            )}
            <div className="thumb-overlay">
              <span className="thumb-play">▶</span>
            </div>
          </div>
        )}
      </button>

      {/* Content */}
      <div className="card-content">
        <div className="card-top">
          <a className="handle" href={`https://www.tiktok.com/@${video.handle}`} target="_blank" rel="noopener noreferrer">
            @{video.handle}
          </a>
          <div className="card-meta">
            {followers > 0 && <span className="meta-tag">{fmt(followers)} följare</span>}
            <span className="meta-tag">{new Date(video.published_at).toLocaleDateString("sv-SE")}</span>
          </div>
        </div>

        <div className="stats-grid">
          {stats.map((s) => (
            <div key={s.key} className={`stat ${highlight === s.key ? "stat--hi" : ""}`}>
              <span className="stat-val">{s.value}</span>
              <span className="stat-key">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <a className="ext" href={video.video_url} target="_blank" rel="noopener noreferrer" aria-label="Öppna på TikTok">
        TikTok →
      </a>
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
    <main className="page-root">
      <header className="header">
        <div className="header-inner">
          <h1 className="wordmark">
            <span className="wordmark-gold">Guld</span>raketen
          </h1>
          <p className="header-desc">Sveriges mest engagerande TikTok-konton · 2026</p>
        </div>
        <div className="header-rule" />
      </header>

      <div className="controls">
        <div className="control-row">
          <span className="control-label">Sortera på</span>
          <div className="seg">
            {SORT_OPTIONS.map((o) => (
              <button key={o.key} className={`seg-btn ${sort === o.key ? "seg-btn--on" : ""}`} onClick={() => setSort(o.key)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="control-row">
          <span className="control-label">Följare</span>
          <div className="seg">
            {SIZE_OPTIONS.map((o) => (
              <button key={o.key} className={`seg-btn ${size === o.key ? "seg-btn--on" : ""}`} onClick={() => setSize(o.key)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!loading && !error && <p className="count">{sorted.length} videos</p>}

      {loading && <p className="state">Laddar…</p>}
      {error && <p className="state state--err">{error}</p>}
      {!loading && !error && sorted.length === 0 && <p className="state">Inga videos matchar filtret.</p>}

      <div className="video-list">
        {sorted.map((v, i) => (
          <VideoCard key={v.id} video={v} rank={i + 1} highlight={sort} />
        ))}
      </div>

      <footer className="page-footer">
        © {new Date().getFullYear()} Guldraketen &nbsp;·&nbsp;
        <a href="/nominera" className="footer-link">Nominera ett konto</a>
      </footer>
    </main>
  );
}