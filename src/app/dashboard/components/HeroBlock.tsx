"use client";

import { useEffect, useState } from "react";
import { Eye, ThumbsUp, MessageCircle, Share2, Bookmark, Flame } from "lucide-react";

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

type BoostFilter = "all" | "organic" | "boosted";

export default function HeroBlock({
  handle,
  boost,
  onBoostChange,
}: {
  handle: string;
  boost: BoostFilter;
  onBoostChange: (b: BoostFilter) => void;
}) {
  const [data, setData] = useState<HeroData | null>(null);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    setIsFetching(true);
    const params = new URLSearchParams({ handle });
    if (boost !== "all") params.set("boost", boost);
    let cancelled = false;
    fetch(`/api/dashboard/hero?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (!d?.error) setData(d);
        setIsFetching(false);
      })
      .catch(() => { if (!cancelled) setIsFetching(false); });
    return () => { cancelled = true; };
  }, [handle, boost]);

  const ready = !!data && !isFetching;
  const name = data?.display_name ?? (data ? `@${data.handle}` : "");
  const f = data?.followers;
  const b = data?.benchmarks;
  const showDelta = (f?.delta?.meaningful ?? false) && !isFetching;
  const deltaText = showDelta && f?.delta
    ? `${f.delta.abs > 0 ? "+" : ""}${fmt(f.delta.abs)}  ·  ${f.delta.pct > 0 ? "+" : ""}${f.delta.pct.toFixed(1)} %`
    : null;
  const deltaLabel = showDelta && f?.delta
    ? `senaste ${f.delta.days} ${f.delta.days === 1 ? "dagen" : "dagarna"}`
    : null;

  // Bench columns: when data is present, derive from it; otherwise show the
  // canonical 5 metric skeleton chips so the layout stays the same.
  const cols = b
    ? benchCols(b)
    : ([
        { label: "Visningar", icon: <Eye size={14} />, total: 0, avg: 0 },
        { label: "Likes", icon: <ThumbsUp size={14} />, total: 0, avg: 0 },
        { label: "Kommentarer", icon: <MessageCircle size={14} />, total: 0, avg: 0 },
        { label: "Delningar", icon: <Share2 size={14} />, total: 0, avg: 0 },
        { label: "Favoriter", icon: <Bookmark size={14} />, total: 0, avg: 0 },
      ] as { label: string; icon: React.ReactNode; total: number; avg: number }[]);

  function Skel({ w, h }: { w: number | string; h?: number | string }) {
    return <span className="hero-skel" style={{ width: w, height: h ?? "1em" }} aria-hidden />;
  }

  return (
    <>
      <style>{css}</style>
      <div className="hero-block">
        <div className="hero-top">
          <div className="hero-identity">
            {data?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.avatar_url} alt="" className="hero-avatar" />
            ) : (
              <div className="hero-avatar hero-avatar--placeholder" />
            )}
            <div className="hero-identity-info">
              <h1 className="hero-name">
                {data ? name : <Skel w={180} h={28} />}
              </h1>
              <p className="hero-handle">
                {data ? `@${data.handle}` : <Skel w={120} h={14} />}
              </p>
            </div>
          </div>

          <div className="hero-followers-block">
            <p className="hero-stat-label">Följare</p>
            <p className="hero-stat-big">
              {ready && f ? fmt(f.current) : <Skel w={110} h={32} />}
            </p>
            {ready && f && f.history.length >= 2 ? (
              <Sparkline points={f.history} />
            ) : (
              <span className="hero-skel" style={{ width: 160, height: 36, display: "block", marginTop: 6 }} aria-hidden />
            )}
            {deltaText ? (
              <p className="hero-followers-delta">
                <span className={`hero-delta-val${(f?.delta?.abs ?? 0) >= 0 ? " up" : " down"}`}>{deltaText}</span>
                <span className="hero-delta-period">  {deltaLabel}</span>
              </p>
            ) : isFetching ? (
              <p className="hero-followers-delta"><Skel w={180} h={14} /></p>
            ) : null}
          </div>
        </div>

        <div className="hero-benchmarks-wrap">
          <div className="hero-benchmarks-head">
            <p className="hero-stat-label">Benchmarks <span className="hero-stat-sublabel">(totalt och snitt per video)</span></p>
            <div className="hero-boost-pills">
              {([
                { key: "all",     label: "Allt"      },
                { key: "organic", label: "Organiskt" },
                { key: "boosted", label: "Boostat"   },
              ] as { key: BoostFilter; label: string }[]).map((b) => (
                <button
                  key={b.key}
                  className={"hero-boost-pill" + (boost === b.key ? " active" : "")}
                  onClick={() => onBoostChange(b.key)}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
          <div className="hero-benchmarks">
            <div className="hero-bench hero-bench--er">
              <div className="hero-bench-header">
                <span className="hero-bench-icon"><Flame size={14} /></span>
                <span className="hero-bench-lbl">Eng.rate*</span>
              </div>
              <p className="hero-bench-total">
                {ready && b ? `${b.avg_er.toFixed(2)}%` : <Skel w={70} h={20} />}
              </p>
              <p className="hero-bench-avg"><span className="hero-bench-avg-suffix">viktad</span></p>
            </div>
            {cols.map((c) => (
              <div key={c.label} className="hero-bench">
                <div className="hero-bench-header">
                  <span className="hero-bench-icon">{c.icon}</span>
                  <span className="hero-bench-lbl">{c.label}</span>
                </div>
                <p className="hero-bench-total">
                  {ready ? fmt(c.total) : <Skel w={80} h={20} />}
                </p>
                <p className="hero-bench-avg">
                  {ready ? <>{fmt(c.avg)} <span className="hero-bench-avg-suffix">snitt</span></> : <Skel w={70} h={14} />}
                </p>
              </div>
            ))}
          </div>
        </div>

        <p className="hero-meta-line">
          {ready && b && data ? (
            <>
              {b.videos} {b.videos === 1 ? "video" : "videor"} inhämtade sedan {formatDate(data.tracked_since)}
              {b.posts_per_week >= 1
                ? `  ·  ${b.posts_per_week.toFixed(1)} per vecka`
                : `  ·  ${(b.posts_per_week * 4.33).toFixed(1)} per månad`}
            </>
          ) : (
            <Skel w={320} h={13} />
          )}
        </p>
        <p className="hero-disclaimer">
          *Viktad engagement rate, där interaktioner multipliceras enligt följande. Likes × 1, kommentarer × 5, delningar × 10, favoriter × 5. Detta för att bättre reflektera engagemang från publiken — alla interaktioner är inte värda lika mycket. En delning väger tyngre än en like.
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
  /* Skeleton placeholder bar */
  .hero-skel {
    display: inline-block;
    vertical-align: middle;
    background: rgba(28,27,25,0.06);
    background-image: linear-gradient(90deg,
      rgba(28,27,25,0) 0%,
      rgba(28,27,25,0.08) 50%,
      rgba(28,27,25,0) 100%);
    background-repeat: no-repeat;
    background-size: 200% 100%;
    background-position: -100% 0;
    border-radius: 6px;
    color: transparent;
    animation: hero-shimmer 1.4s ease-in-out infinite;
  }
  @keyframes hero-shimmer {
    0%   { background-position: -100% 0; }
    100% { background-position: 200% 0; }
  }

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

  /* Benchmarks: rounded chip per metric */
  .hero-benchmarks-wrap {
    padding-top: 1.25rem;
    border-top: 1px solid rgba(28,27,25,0.08);
  }
  /* Scoped: Benchmarks label inside the benchmarks block is +25% vs other stat labels */
  .hero-benchmarks-wrap .hero-stat-label { font-size: 15px; }
  .hero-benchmarks-wrap .hero-stat-sublabel { font-size: 13px; }
  .hero-benchmarks-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 6px;
  }
  .hero-boost-pills {
    display: inline-flex;
    background: rgba(28,27,25,0.06);
    border-radius: 999px;
    padding: 3px;
  }
  .hero-boost-pill {
    font-family: 'Barlow', sans-serif;
    font-size: 12px;
    font-weight: 500;
    color: rgba(28,27,25,0.6);
    background: transparent;
    border: none;
    padding: 4px 12px;
    border-radius: 999px;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
    white-space: nowrap;
  }
  .hero-boost-pill:hover { color: #1C1B19; }
  .hero-boost-pill.active {
    background: #fff;
    color: #1C1B19;
    box-shadow: 0 1px 2px rgba(28,27,25,0.08);
  }
  .hero-benchmarks {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(165px, 1fr));
    gap: 10px;
  }
  .hero-bench {
    display: inline-flex;
    flex-direction: column;
    gap: 8px;
    background: rgba(28,27,25,0.04);
    border-radius: 10px;
    padding: 14px 18px;
  }
  .hero-bench-header {
    display: flex;
    align-items: center;
    gap: 8px;
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
  .hero-bench-lbl {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(28,27,25,0.85);
  }
  .hero-bench-total {
    margin: 0;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.85rem;
    font-weight: 700;
    line-height: 1;
    color: #1C1B19;
    font-variant-numeric: tabular-nums;
  }
  .hero-bench-avg {
    margin: 0;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1;
    color: rgba(28,27,25,0.55);
    font-variant-numeric: tabular-nums;
  }
  .hero-bench-avg-suffix {
    font-family: 'Barlow', sans-serif;
    font-size: 12px;
    font-weight: 400;
    color: rgba(28,27,25,0.45);
    letter-spacing: 0.02em;
  }

  .hero-meta-line {
    margin: 0;
    font-size: 13px;
    color: rgba(28,27,25,0.5);
    padding-top: 0.85rem;
    border-top: 1px solid rgba(28,27,25,0.08);
  }
  .hero-disclaimer {
    margin: 2px 0 0;
    font-size: 12px;
    color: rgba(28,27,25,0.45);
    line-height: 1.5;
  }
  .hero-bench--er {
    background: rgba(232, 17, 106, 0.06);
  }
  .hero-bench--er .hero-bench-icon {
    color: #C8962A;
  }

  @media (max-width: 559px) {
    .hero-block { padding: 1.25rem 1rem; }
    .hero-top {
      flex-direction: column;
      align-items: stretch;
      gap: 1rem;
    }
    .hero-followers-block {
      align-items: flex-start;
      text-align: left;
      width: 100%;
      padding-top: 0.9rem;
      border-top: 1px solid rgba(28,27,25,0.08);
    }
    .hero-stat-big { font-size: 2rem; }
    .hero-name { font-size: 1.6rem; }

    /* Mobile chip sizing — total 18px / snitt 15px per spec */
    .hero-benchmarks {
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 8px;
    }
    .hero-bench { padding: 10px 12px; gap: 6px; }
    .hero-bench-icon { width: 24px; height: 24px; }
    .hero-bench-lbl { font-size: 13px; }
    .hero-bench-total { font-size: 18px; }
    .hero-bench-avg { font-size: 15px; }
    .hero-benchmarks-wrap .hero-stat-label { font-size: 12px; }
    .hero-benchmarks-wrap .hero-stat-sublabel { font-size: 11px; }
  }
`;
