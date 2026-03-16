"use client";

import { useEffect, useState, useMemo, useRef } from "react";
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
type ViewsFilter = "all" | "under10k" | "10k100k" | "100k1m" | "over1m";

function accountSize(followers: number): SizeFilter {
  if (followers < 10_000) return "small";
  if (followers < 100_000) return "medium";
  return "large";
}

function viewsRange(views: number): ViewsFilter {
  if (views < 10_000) return "under10k";
  if (views < 100_000) return "10k100k";
  if (views < 1_000_000) return "100k1m";
  return "over1m";
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

// Format "2026-W10" → "Vecka 10, 2026"
function formatWeek(w: string): string {
  const [year, week] = w.split("-W");
  return `Vecka ${parseInt(week)}, ${year}`;
}

// ─── SlidingTabs ─────────────────────────────────────────────────────────────

function SlidingTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      const container = containerRef.current.getBoundingClientRect();
      const active = activeRef.current.getBoundingClientRect();
      setPillStyle({ left: active.left - container.left, width: active.width });
    }
  }, [value]);

  return (
    <div className="sliding-tabs" ref={containerRef}>
      <div className="sliding-pill" style={{ left: pillStyle.left, width: pillStyle.width }} />
      {options.map((o) => (
        <button
          key={o.key}
          ref={value === o.key ? activeRef : undefined}
          className={`sliding-tab ${value === o.key ? "sliding-tab--on" : ""}`}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── VideoModal ───────────────────────────────────────────────────────────────

function VideoModal({ video, onClose }: { video: Video; onClose: () => void }) {
  const embedId = tiktokEmbedId(video.video_url);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-handle">@{video.handle}</span>
          <button className="modal-close" onClick={onClose} aria-label="Stäng">✕</button>
        </div>
        {embedId ? (
          <iframe
            src={`https://www.tiktok.com/embed/v2/${embedId}`}
            className="modal-iframe"
            allowFullScreen
            allow="autoplay"
            scrolling="no"
          />
        ) : (
          <div className="modal-fallback">
            <a href={video.video_url} target="_blank" rel="noopener noreferrer">
              Öppna på TikTok →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── VideoCard ────────────────────────────────────────────────────────────────

function VideoCard({ video, rank, highlight }: { video: Video; rank: number; highlight: SortKey }) {
  const [showModal, setShowModal] = useState(false);
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
    <>
      {showModal && <VideoModal video={video} onClose={() => setShowModal(false)} />}
      <article className="card">
        <div className="rank-stripe" style={{ background: rankBg, border: rankBorder }}>
          <span className="rank-num" style={{ color: rankColor }}>{rank}</span>
        </div>

        <button className="thumb-btn" onClick={() => setShowModal(true)} aria-label="Visa video">
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
              <span className="thumb-placeholder">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <polygon points="4,2 14,8 4,14" fill="#c8b89a" />
                </svg>
              </span>
            )}
            <div className="thumb-overlay">
              <span className="thumb-play">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <polygon points="5,2 18,10 5,18" fill="white" />
                </svg>
              </span>
            </div>
          </div>
        </button>

        <div className="card-content">
          <div className="card-top">
            <a
              className="handle"
              href={`https://www.tiktok.com/@${video.handle}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              @{video.handle}
            </a>
            <div className="card-meta">
              {followers > 0 && <span className="meta-tag">{fmt(followers)} följare</span>}
              <span className="meta-tag">
                {new Date(video.published_at).toLocaleDateString("sv-SE")}
              </span>
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

        <a
          className="ext"
          href={video.video_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Öppna på TikTok"
        >
          TikTok →
        </a>
      </article>
    </>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "engagement_rate", label: "Engagemangsgrad" },
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

const VIEWS_OPTIONS: { key: ViewsFilter; label: string }[] = [
  { key: "all", label: "Alla" },
  { key: "under10k", label: "< 10K" },
  { key: "10k100k", label: "10K–100K" },
  { key: "100k1m", label: "100K–1M" },
  { key: "over1m", label: "> 1M" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [weeks, setWeeks] = useState<string[]>([]);
  const [week, setWeek] = useState<string>("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [loadingWeeks, setLoadingWeeks] = useState(true);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortKey>("engagement_rate");
  const [size, setSize] = useState<SizeFilter>("all");
  const [views, setViews] = useState<ViewsFilter>("all");

  // Load available weeks on mount
  useEffect(() => {
    fetch("/api/weeks")
      .then((r) => r.json())
      .then((data: string[]) => {
        setWeeks(data);
        // Default: most recent week (index 0 = newest)
        if (data.length > 0) setWeek(data[0]);
        setLoadingWeeks(false);
      })
      .catch(() => {
        setError("Kunde inte ladda veckor.");
        setLoadingWeeks(false);
      });
  }, []);

  // Load videos when week changes
  useEffect(() => {
    if (!week) return;
    setLoadingVideos(true);
    setError("");
    fetch(`/api/videos?week=${week}`)
      .then((r) => r.json())
      .then((data) => { setVideos(data); setLoadingVideos(false); })
      .catch(() => { setError("Kunde inte ladda videos."); setLoadingVideos(false); });
  }, [week]);

  const sorted = useMemo(() => {
    return [...videos]
      .filter((v) => size === "all" || accountSize(v.accounts?.followers ?? 0) === size)
      .filter((v) => views === "all" || viewsRange(v.views ?? 0) === views)
      .sort((a, b) => (b[sort] ?? 0) - (a[sort] ?? 0));
  }, [videos, sort, size, views]);

  const loading = loadingWeeks || loadingVideos;

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
        {/* Week selector */}
        <div className="control-row">
          <span className="control-label">Vecka</span>
          <div className="week-select-wrap">
            <select
              className="week-select"
              value={week}
              onChange={(e) => setWeek(e.target.value)}
              disabled={weeks.length === 0}
            >
              {weeks.map((w) => (
                <option key={w} value={w}>{formatWeek(w)}</option>
              ))}
              {weeks.length === 0 && <option value="">Laddar…</option>}
            </select>
            <span className="week-select-arrow">▾</span>
          </div>
        </div>

        {/* Sort */}
        <div className="control-row">
          <span className="control-label">Sortera på</span>
          <SlidingTabs options={SORT_OPTIONS} value={sort} onChange={setSort} />
        </div>

        {/* Followers filter */}
        <div className="control-row">
          <span className="control-label">Följare</span>
          <SlidingTabs options={SIZE_OPTIONS} value={size} onChange={setSize} />
        </div>

        {/* Views filter */}
        <div className="control-row">
          <span className="control-label">Visningar</span>
          <SlidingTabs options={VIEWS_OPTIONS} value={views} onChange={setViews} />
        </div>
      </div>

      {!loading && !error && <p className="count">{sorted.length} videos</p>}
      {loading && <p className="state">Laddar…</p>}
      {error && <p className="state state--err">{error}</p>}
      {!loading && !error && sorted.length === 0 && (
        <p className="state">Inga videos för den här veckan.</p>
      )}

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