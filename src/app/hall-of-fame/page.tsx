"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Suspense } from "react";

interface Winner {
  week: string;
  handle: string;
  displayName: string;
  bestVideo: {
    video_url: string;
    thumbnail_url: string | null;
    caption: string | null;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    engagement_rate: number;
  };
}

interface ScoreEntry {
  handle: string;
  displayName: string;
  totalPoints: number;
  gold: number;
  silver: number;
  bronze: number;
}

function fmtWeek(w: string) {
  const m = w.match(/(\d{4})-W(\d{2})/);
  if (!m) return w;
  return `V${parseInt(m[2])} ${m[1]}`;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return Math.round(n / 1_000) + "K";
  return String(n);
}

function Thumb({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 14, color: "rgba(28,27,25,.12)" }}>
          {name[0]}
        </span>
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={name}
      fill
      sizes="52px"
      style={{ objectFit: "cover" }}
      unoptimized
      onError={() => setFailed(true)}
    />
  );
}

function MedalDot({ color }: { color: string }) {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" style={{ display: "inline-block", flexShrink: 0 }}>
      <circle cx="4" cy="4" r="4" fill={color} />
    </svg>
  );
}

function MedalBadges({ gold, silver, bronze }: { gold: number; silver: number; bronze: number }) {
  if (!gold && !silver && !bronze) return <span style={{ opacity: 0.3 }}>—</span>;
  return (
    <span className="gr-medal-badges">
      {gold > 0 && <span className="gr-medal-item">{gold}× <MedalDot color="#C8962A" /></span>}
      {silver > 0 && <span className="gr-medal-item">{silver}× <MedalDot color="#8A9299" /></span>}
      {bronze > 0 && <span className="gr-medal-item">{bronze}× <MedalDot color="#96614A" /></span>}
    </span>
  );
}

type SortOrder = "newest" | "oldest" | "er";
const SORT_OPTS: { key: SortOrder; label: string }[] = [
  { key: "newest", label: "Nyaste" },
  { key: "oldest", label: "Äldsta" },
  { key: "er", label: "Eng.rate" },
];

// Stat icon SVGs
function HeartIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z"/>
    </svg>
  );
}
function CommentIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3c-4.97 0-9 3.186-9 7.115 0 2.055.999 3.898 2.604 5.207-.141.994-.671 2.716-2.604 3.678 2.132-.142 4.658-1.113 5.922-2.203C9.883 16.943 10.925 17 12 17c4.97 0 9-3.186 9-7.115C21 6.186 16.97 3 12 3z"/>
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 17 20 12 15 7"/>
      <path d="M4 18v-2a4 4 0 014-4h12"/>
    </svg>
  );
}

function HallOfFameInner() {
  const [winners, setWinners] = useState<Winner[]>([]);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [loadingWinners, setLoadingWinners] = useState(true);
  const [loadingScores, setLoadingScores] = useState(true);
  const [sort, setSort] = useState<SortOrder>("newest");

  useEffect(() => {
    fetch("/api/tidigare-raketer")
      .then((r) => r.json())
      .then((d) => { setWinners(d); setLoadingWinners(false); });
    fetch("/api/topplistan")
      .then((r) => r.json())
      .then((d) => { setScores(d); setLoadingScores(false); });
  }, []);

  const sortedWinners = useMemo(() => {
    const list = [...winners];
    if (sort === "oldest") return list.reverse();
    if (sort === "er") return list.sort((a, b) => b.bestVideo.engagement_rate - a.bestVideo.engagement_rate);
    return list;
  }, [winners, sort]);

  return (
    <main className="gr-root gr-page">

      {/* ── Page header ── */}
      <div className="gr-page-hdr">
        <h1 className="gr-page-title">Hall of Fame</h1>
      </div>

      {/* ── Split grid ── */}
      <div className="gr-content-grid">

        {/* ── Left: Raketer ── */}
        <div className="gr-content-main">
          <div className="gr-hof-section-hdr">
            <span className="gr-hof-section-title">Raketer</span>
            <div className="gr-sort-pills">
              {SORT_OPTS.map((opt) => (
                <button
                  key={opt.key}
                  className={"gr-sort-pill" + (sort === opt.key ? " active" : "")}
                  onClick={() => setSort(opt.key)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {loadingWinners ? (
            <div className="gr-loading" style={{ padding: "24px" }}>Laddar...</div>
          ) : sortedWinners.length === 0 ? (
            <p style={{ padding: "24px", color: "var(--gr-muted)", fontFamily: "var(--gr-mono)", fontSize: "var(--gr-fs-xs)" }}>Inga vinnare ännu.</p>
          ) : (
            <>
              {sortedWinners.map((w) => (
                <a
                  key={w.week}
                  href={w.bestVideo.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gr-raket-row"
                >
                  {/* Thumbnail */}
                  <div className="gr-raket-thumb-sm">
                    <Thumb src={w.bestVideo.thumbnail_url} name={w.displayName} />
                  </div>

                  {/* Name + week */}
                  <div className="gr-entry-main">
                    <p className="gr-entry-name" style={{ fontSize: "15px", color: "var(--gr-dark)" }}>
                      {w.displayName}
                    </p>
                    <p className="gr-entry-meta" style={{ color: "var(--gr-muted)" }}>
                      {fmtWeek(w.week)}
                    </p>
                  </div>

                  {/* Likes · Comments · Shares */}
                  <div className="gr-raket-stats">
                    <span className="gr-raket-stat">
                      <HeartIcon />
                      {fmt(w.bestVideo.likes)}
                    </span>
                    <span className="gr-raket-stat">
                      <CommentIcon />
                      {fmt(w.bestVideo.comments)}
                    </span>
                    <span className="gr-raket-stat">
                      <ShareIcon />
                      {fmt(w.bestVideo.shares)}
                    </span>
                  </div>

                  {/* Eng.rate */}
                  <div className="gr-entry-rate">
                    <span className="gr-entry-rate-val" style={{ color: "var(--gr-gold)" }}>
                      {Number(w.bestVideo.engagement_rate).toFixed(2)}%
                    </span>
                    <span className="gr-entry-rate-lbl" style={{ color: "rgba(28,27,25,.48)" }}>
                      eng.rate
                    </span>
                  </div>
                </a>
              ))}
            </>
          )}
        </div>

        {/* ── Right: Konton ── */}
        <div className="gr-content-aside" style={{ padding: "0 0 32px" }}>
          <div className="gr-hof-section-hdr">
            <span className="gr-hof-section-title">Konton</span>
          </div>

          {loadingScores ? (
            <div className="gr-loading">Laddar...</div>
          ) : scores.length === 0 ? (
            <p style={{ color: "var(--gr-muted)", fontFamily: "var(--gr-mono)", fontSize: "var(--gr-fs-xs)" }}>Inga poäng ännu.</p>
          ) : (
            <div style={{ padding: "15px 24px" }}>
            <table className="gr-score-table">
              <thead>
                <tr>
                  <th style={{ width: 28 }}>#</th>
                  <th>Konto</th>
                  <th className="right">Medaljer</th>
                  <th className="right">Poäng</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((entry, i) => (
                  <tr key={entry.handle} className="gr-score-row">
                    <td className="gr-score-rank">{i + 1}</td>
                    <td className="gr-score-name">{entry.displayName}</td>
                    <td><MedalBadges gold={entry.gold} silver={entry.silver} bronze={entry.bronze} /></td>
                    <td className="gr-score-pts">{entry.totalPoints}p</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}

export default function HallOfFamePage() {
  return (
    <Suspense>
      <HallOfFameInner />
    </Suspense>
  );
}
