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

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 10_000) return Math.round(n / 1_000) + "k";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return Math.round(n).toString();
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
  const deltaPct = f.delta ? f.delta.pct : null;
  const showDelta = f.delta?.meaningful ?? false;
  const deltaText = showDelta && f.delta
    ? `${f.delta.abs > 0 ? "+" : ""}${fmt(f.delta.abs)}  ·  ${deltaPct! > 0 ? "+" : ""}${deltaPct!.toFixed(1)} %`
    : null;
  const deltaLabel = showDelta && f.delta
    ? `senaste ${f.delta.days} ${f.delta.days === 1 ? "dagen" : "dagarna"}`
    : "Trend bygger upp — för få datapunkter ännu";

  return (
    <>
      <style>{css}</style>
      <div className="hero-block">
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
            <p className="hero-since">Inhämtade videor sedan {formatDate(data.tracked_since)}</p>
          </div>
        </div>

        <div className="hero-followers">
          <div className="hero-followers-row">
            <div>
              <p className="hero-stat-label">Följare</p>
              <p className="hero-stat-big">{fmt(f.current)}</p>
            </div>
            <Sparkline points={f.history} />
          </div>
          <p className={`hero-followers-delta${showDelta ? "" : " hero-followers-delta--quiet"}`}>
            {deltaText ? (
              <>
                <span className={`hero-delta-val${(f.delta?.abs ?? 0) >= 0 ? " up" : " down"}`}>{deltaText}</span>
                <span className="hero-delta-period">  {deltaLabel}</span>
              </>
            ) : (
              <span className="hero-delta-period">{deltaLabel}</span>
            )}
          </p>
        </div>

        <div>
          <p className="hero-stat-label">Vanliga siffror per video</p>
          <div className="hero-benchmarks">
            <Benchmark icon={<Eye size={14} />} label="Visningar" value={b.avg_views} />
            <Benchmark icon={<ThumbsUp size={14} />} label="Likes" value={b.avg_likes} />
            <Benchmark icon={<MessageCircle size={14} />} label="Kommentarer" value={b.avg_comments} />
            <Benchmark icon={<Share2 size={14} />} label="Delningar" value={b.avg_shares} />
            {b.avg_collects != null && (
              <Benchmark icon={<Bookmark size={14} />} label="Favoriter" value={b.avg_collects} />
            )}
          </div>
        </div>

        <p className="hero-meta-line">
          {b.videos} {b.videos === 1 ? "video" : "videor"} inhämtade
          {b.posts_per_week >= 1
            ? `  ·  ${b.posts_per_week.toFixed(1)} per vecka`
            : `  ·  ${(b.posts_per_week * 4.33).toFixed(1)} per månad`}
          {b.avg_er > 0 && `  ·  ⌀ engagemang ${b.avg_er.toFixed(2)} %`}
        </p>
      </div>
    </>
  );
}

function Benchmark({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="hero-bench">
      <span className="hero-bench-icon">{icon}</span>
      <div>
        <p className="hero-bench-val">{fmtCompact(value)}</p>
        <p className="hero-bench-lbl">{label}</p>
      </div>
    </div>
  );
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
    gap: 1.75rem;
    background: #fff;
    border: 1px solid rgba(28,27,25,0.1);
    border-radius: 14px;
    padding: 1.5rem 1.75rem;
    box-shadow: 0 1px 2px rgba(28,27,25,0.04);
    margin-bottom: 2rem;
  }

  .hero-identity {
    display: flex;
    align-items: center;
    gap: 1rem;
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
  }
  .hero-name {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.85rem;
    font-weight: 700;
    line-height: 1;
    margin: 0;
    color: #1C1B19;
  }
  .hero-handle {
    font-size: 13px;
    color: rgba(28,27,25,0.55);
    margin: 0;
  }
  .hero-since {
    font-size: 12px;
    color: rgba(28,27,25,0.45);
    margin: 2px 0 0;
  }

  .hero-followers {
    border-top: 1px solid rgba(28,27,25,0.08);
    padding-top: 1.25rem;
  }
  .hero-followers-row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
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
  }

  .hero-followers-delta {
    margin: 8px 0 0;
    font-size: 14px;
    color: rgba(28,27,25,0.75);
  }
  .hero-followers-delta--quiet { color: rgba(28,27,25,0.45); font-style: italic; font-size: 13px; }
  .hero-delta-val { font-weight: 600; }
  .hero-delta-val.up { color: #2d7a3d; }
  .hero-delta-val.down { color: #9c2828; }
  .hero-delta-period { color: rgba(28,27,25,0.5); }

  .hero-benchmarks {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1rem;
  }
  .hero-bench {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(28,27,25,0.04);
    border-radius: 10px;
    padding: 0.7rem 0.85rem;
  }
  .hero-bench-icon {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(28,27,25,0.7);
    flex-shrink: 0;
  }
  .hero-bench-val {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.3rem;
    font-weight: 700;
    line-height: 1;
    margin: 0;
    color: #1C1B19;
  }
  .hero-bench-lbl {
    font-size: 12px;
    color: rgba(28,27,25,0.55);
    margin: 2px 0 0;
  }

  .hero-meta-line {
    margin: 0;
    font-size: 13px;
    color: rgba(28,27,25,0.55);
    padding-top: 1rem;
    border-top: 1px solid rgba(28,27,25,0.08);
  }

  @media (max-width: 559px) {
    .hero-block { padding: 1.25rem 1rem; }
    .hero-stat-big { font-size: 2rem; }
    .hero-name { font-size: 1.5rem; }
  }
`;
