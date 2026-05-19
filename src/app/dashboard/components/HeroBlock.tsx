"use client";

import { useEffect, useState } from "react";
import { Eye, ThumbsUp, MessageCircle, Share2, Bookmark } from "lucide-react";

interface HeroData {
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  tracked_since: string;
  followers: {
    current: number;
    history: { date: string; followers: number }[];
    delta: { abs: number; pct: number; meaningful: boolean; days: number } | null;
    rounding_step: number;
  };
  benchmarks: {
    videos: number;
    posts_per_week: number;
    total_views: number;
    total_likes: number;
    total_comments: number;
    total_shares: number;
    total_collects: number | null;
    avg_views: number;
    avg_likes: number;
    avg_comments: number;
    avg_shares: number;
    avg_collects: number | null;
    avg_er: number;
  };
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("sv-SE");
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
}

function Sparkline({ points }: { points: { date: string; followers: number }[] }) {
  if (points.length < 2) return null;
  const values = points.map((p) => p.followers);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const w = 160;
  const h = 36;
  const stepX = w / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = h - ((p.followers - min) / range) * h;
    return `${x},${y}`;
  });
  return (
    <svg className="hero-sparkline" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords.join(" ")}
      />
    </svg>
  );
}

export default function HeroBlock({ handle }: { handle: string }) {
  const [data, setData] = useState<HeroData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/hero?handle=${encodeURIComponent(handle)}`)
      .then((r) => r.json())
      .then((d) => { setData(d?.error ? null : d); setLoading(false); })
      .catch(() => { setData(null); setLoading(false); });
  }, [handle]);

  if (loading || !data) {
    return <div className="hero-loading">Laddar…</div>;
  }

  const name = data.display_name ?? `@${data.handle}`;
  const f = data.followers;
  const b = data.benchmarks;
  const showDelta = f.delta?.meaningful ?? false;
  const deltaText = showDelta && f.delta
    ? `${f.delta.abs > 0 ? "+" : ""}${fmt(f.delta.abs)}  ·  ${f.delta.pct > 0 ? "+" : ""}${f.delta.pct.toFixed(1)} %`
    : null;
  const deltaLabel = showDelta && f.delta
    ? `senaste ${f.delta.days} ${f.delta.days === 1 ? "dagen" : "dagarna"}`
    : null;

  return (
    <>
      <style>{css}</style>
      <div className="hero-block">
        <div className="hero-top">
          <div className="hero-identity">
            {data.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.avatar_url} alt="" className="hero-avatar" />
            ) : (
              <div className="hero-avatar hero-avatar--placeholder" />
            )}
            <div className="hero-identity-info">
              <h1 className="hero-name">{name}</h1>
              <p className="hero-handle">@{data.handle}</p>
            </div>
          </div>

          <div className="hero-followers-block">
            <p className="hero-stat-label">Följare</p>
            <p className="hero-stat-big">{fmt(f.current)}</p>
            <Sparkline points={f.history} />
            {deltaText && (
              <p className="hero-followers-delta">
                <span className={`hero-delta-val${(f.delta?.abs ?? 0) >= 0 ? " up" : " down"}`}>{deltaText}</span>
                <span className="hero-delta-period">  {deltaLabel}</span>
              </p>
            )}
          </div>
        </div>

        <div className="hero-benchmarks-wrap">
          <p className="hero-stat-label">Benchmarks <span className="hero-stat-sublabel">(totalt och snitt per video)</span></p>
          <div className="hero-bench-table">
            <div className="hero-bench-row hero-bench-row--head">
              <span />
              {benchCols(b).map((c) => (
                <span key={c.label} className="hero-bench-col-head" title={c.label}>{c.icon}</span>
              ))}
            </div>
            <div className="hero-bench-row">
              <span className="hero-bench-row-lbl">Totalt</span>
              {benchCols(b).map((c) => (
                <span key={c.label} className="hero-bench-row-val">{fmt(c.total)}</span>
              ))}
            </div>
            <div className="hero-bench-row">
              <span className="hero-bench-row-lbl">Snitt</span>
              {benchCols(b).map((c) => (
                <span key={c.label} className="hero-bench-row-val">{fmt(c.avg)}</span>
              ))}
            </div>
          </div>
        </div>

        <p className="hero-meta-line">
          {b.videos} {b.videos === 1 ? "video" : "videor"} inhämtade sedan {formatDate(data.tracked_since)}
          {b.posts_per_week >= 1
            ? `  ·  ${b.posts_per_week.toFixed(1)} per vecka`
            : `  ·  ${(b.posts_per_week * 4.33).toFixed(1)} per månad`}
          {b.avg_er > 0 && `  ·  Snitt engagemang ${b.avg_er.toFixed(2)} %`}
        </p>
      </div>
    </>
  );
}

function benchCols(b: HeroData["benchmarks"]) {
  const cols: { label: string; icon: React.ReactNode; total: number; avg: number }[] = [
    { label: "Visningar", icon: <Eye size={16} />, total: b.total_views, avg: b.avg_views },
    { label: "Likes", icon: <ThumbsUp size={16} />, total: b.total_likes, avg: b.avg_likes },
    { label: "Kommentarer", icon: <MessageCircle size={16} />, total: b.total_comments, avg: b.avg_comments },
    { label: "Delningar", icon: <Share2 size={16} />, total: b.total_shares, avg: b.avg_shares },
  ];
  if (b.total_collects != null && b.avg_collects != null) {
    cols.push({ label: "Favoriter", icon: <Bookmark size={16} />, total: b.total_collects, avg: b.avg_collects });
  }
  return cols;
}

const css = `
  .hero-loading {
    padding: 2rem 0;
    color: #888;
    font-size: 14px;
  }

  .hero-block {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    background: #fff;
    border: 1px solid rgba(28,27,25,0.1);
    border-radius: 14px;
    padding: 1.5rem 1.75rem;
    box-shadow: 0 1px 2px rgba(28,27,25,0.04);
    margin-bottom: 2rem;
  }

  /* Top row: identity (left) + followers (right) */
  .hero-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .hero-identity {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
    min-width: 0;
  }

  .hero-avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }
  .hero-avatar--placeholder {
    background: rgba(28,27,25,0.08);
  }

  .hero-identity-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .hero-name {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 2rem;
    font-weight: 700;
    line-height: 1;
    margin: 0;
    color: #1C1B19;
  }
  .hero-handle {
    font-size: 14px;
    color: rgba(28,27,25,0.55);
    margin: 0;
  }

  .hero-followers-block {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    text-align: right;
    flex-shrink: 0;
  }

  .hero-stat-label {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(28,27,25,0.55);
    margin: 0 0 4px;
  }
  .hero-stat-sublabel {
    font-weight: 500;
    letter-spacing: 0.02em;
    text-transform: none;
    color: rgba(28,27,25,0.5);
  }
  .hero-stat-big {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 2.4rem;
    font-weight: 700;
    line-height: 1;
    margin: 0;
    color: #1C1B19;
  }
  .hero-sparkline {
    color: rgba(28,27,25,0.55);
    margin-top: 6px;
  }

  .hero-followers-delta {
    margin: 6px 0 0;
    font-size: 13px;
    color: rgba(28,27,25,0.75);
  }
  .hero-delta-val { font-weight: 600; }
  .hero-delta-val.up { color: #2d7a3d; }
  .hero-delta-val.down { color: #9c2828; }
  .hero-delta-period { color: rgba(28,27,25,0.5); }

  /* Benchmarks table: icon at top of each column, two value rows below */
  .hero-benchmarks-wrap {
    padding-top: 1.25rem;
    border-top: 1px solid rgba(28,27,25,0.08);
  }
  .hero-bench-table {
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow-x: auto;
  }
  .hero-bench-row {
    display: grid;
    grid-template-columns: 110px repeat(5, 1fr);
    column-gap: 14px;
    align-items: center;
  }
  .hero-bench-row--head {
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(28,27,25,0.08);
    margin-bottom: 4px;
  }
  .hero-bench-col-head {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    color: rgba(28,27,25,0.6);
  }
  .hero-bench-row-lbl {
    font-size: 13px;
    color: rgba(28,27,25,0.6);
    font-weight: 600;
  }
  .hero-bench-row-val {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.05rem;
    font-weight: 700;
    color: #1C1B19;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .hero-meta-line {
    margin: 0;
    font-size: 13px;
    color: rgba(28,27,25,0.5);
    padding-top: 0.85rem;
    border-top: 1px solid rgba(28,27,25,0.08);
  }

  @media (max-width: 559px) {
    .hero-block { padding: 1.25rem 1rem; }
    .hero-top { align-items: flex-start; }
    .hero-followers-block { align-items: flex-start; text-align: left; }
    .hero-stat-big { font-size: 2rem; }
    .hero-name { font-size: 1.6rem; }
  }
`;
