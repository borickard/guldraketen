"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Video {
    handle: string;
    video_url: string;
    published_at: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    engagement_rate: number;
    thumbnail_url: string | null;
    caption: string | null;
    accounts: { followers: number; display_name?: string | null } | null;
}

function fmt(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return String(n);
}

function formatWeek(w: string): string {
    const [year, week] = w.split("-W");
    return `Vecka ${parseInt(week)}, ${year}`;
}

function rankLabel(rank: number): string {
    if (rank === 1) return "🥇 1:a plats";
    if (rank === 2) return "🥈 2:a plats";
    if (rank === 3) return "🥉 3:e plats";
    return `Plats ${rank}`;
}

export default function VideoSharePage() {
    const params = useParams<{ week: string; rank: string }>();
    const week = params?.week ?? "";
    const rankMap: Record<string, number> = { guld: 1, silver: 2, brons: 3 };
    const rankParam = params?.rank ?? "";
    const rankNum = rankMap[rankParam] ?? (parseInt(rankParam.replace("top", "")) || 0);

    const [video, setVideo] = useState<Video | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [playing, setPlaying] = useState(false);

    useEffect(() => {
        if (!week || !rankNum) return;
        fetch(`/api/video?week=${week}&rank=${rankNum}`)
            .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
            .then((data) => { setVideo(data); setLoading(false); })
            .catch(() => { setError(true); setLoading(false); });
    }, [week, rankNum]);

    const weekFmt = week ? formatWeek(week) : "";
    const acct = Array.isArray(video?.accounts) ? video?.accounts[0] : video?.accounts;
    const accountName = acct?.display_name || (video ? `@${video.handle}` : "");
    const followers = acct?.followers ?? 0;
    const er = video?.engagement_rate != null ? video.engagement_rate.toFixed(2) + "%" : "–";

    const stats = video ? [
        { label: "Eng.rate", value: er },
        { label: "Views", value: fmt(video.views ?? 0) },
        { label: "Likes", value: fmt(video.likes ?? 0) },
        { label: "Comments", value: fmt(video.comments ?? 0) },
        { label: "Shares", value: fmt(video.shares ?? 0) },
    ] : [];

    return (
        <>
            <style>{css}</style>
            <main className="sp-root">
                <header className="sp-header">
                    <Link href="/" className="sp-wordmark">
                        <span className="sp-guld">Guld</span>raketen
                    </Link>
                    <p className="sp-header-desc">Sveriges mest engagerande TikTok-konton · 2026</p>
                    <div className="sp-header-rule" />
                </header>

                {loading && <p className="sp-state">Laddar…</p>}
                {error && <p className="sp-state">Kunde inte ladda videon.</p>}

                {video && (
                    <>
                        <div className="sp-rank-nav">
                            <div className="sp-rank-nav-left">
                                {rankNum > 1 && (
                                    <a className="sp-nav-btn" href={`/${week}/${rankNum === 2 ? "guld" : rankNum === 3 ? "silver" : `top${rankNum - 1}`}`}>
                                        <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6L6 11" stroke="currentColor" strokeWidth="1.5" /></svg>
                                        {rankNum === 2 ? "Guld" : rankNum === 3 ? "Silver" : `Plats ${rankNum - 1}`}
                                    </a>
                                )}
                            </div>
                            <div className="sp-rank-nav-center">
                                <span className="sp-rank-title">{rankNum === 1 ? "Guld" : rankNum === 2 ? "Silver" : rankNum === 3 ? "Brons" : `Plats ${rankNum}`}</span>
                                <span className="sp-rank-week">{weekFmt}</span>
                            </div>
                            <div className="sp-rank-nav-right">
                                {rankNum < 3 && (
                                    <a className="sp-nav-btn" href={`/${week}/${rankNum === 1 ? "silver" : rankNum === 2 ? "brons" : `top${rankNum + 1}`}`}>
                                        {rankNum === 1 ? "Silver" : rankNum === 2 ? "Brons" : `Plats ${rankNum + 1}`}
                                        <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M1 1L6 6L1 11" stroke="currentColor" strokeWidth="1.5" /></svg>
                                    </a>
                                )}
                            </div>
                        </div>

                        <div className="sp-card">
                            <div className="sp-thumb-wrap">
                                {playing
                                    ? <iframe
                                        className="sp-embed"
                                        src={`https://www.tiktok.com/embed/v2/${video.video_url.match(/\/video\/(\d+)/)?.[1]}`}
                                        allowFullScreen
                                        allow="autoplay"
                                        scrolling="no"
                                    />
                                    : <>
                                        {video.thumbnail_url
                                            ? <img className="sp-thumb" src={video.thumbnail_url} alt={accountName} />
                                            : <div className="sp-thumb-placeholder" />
                                        }
                                        <button className="sp-play-btn" onClick={() => setPlaying(true)} aria-label="Spela video">
                                            <svg width="20" height="24" viewBox="0 0 20 24"><polygon points="2,2 18,12 2,22" fill="#fff" /></svg>
                                        </button>
                                    </>
                                }
                                <a className="sp-tiktok-btn" href={video.video_url} target="_blank" rel="noopener noreferrer">
                                    Öppna på TikTok <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ display: "inline-block", verticalAlign: "middle" }}><path d="M1 7L7 1M7 1H3M7 1V5" stroke="currentColor" strokeWidth="1.5" /></svg>
                                </a>
                            </div>

                            <div className="sp-info">
                                <div className="sp-account">
                                    <a className="sp-account-name" href={`https://www.tiktok.com/@${video.handle}`} target="_blank" rel="noopener noreferrer">
                                        {accountName}
                                    </a>
                                    {acct?.display_name && (
                                        <span className="sp-handle">@{video.handle}</span>
                                    )}
                                    {followers > 0 && (
                                        <span className="sp-followers">{fmt(followers)} followers</span>
                                    )}
                                    {video.caption && (
                                        <p className="sp-caption">{video.caption}</p>
                                    )}
                                </div>

                                <div className="sp-stats">
                                    <div className="sp-stat-er">
                                        <span className="sp-stat-er-val">{er}</span>
                                        <span className="sp-stat-er-lbl">Engagement rate</span>
                                    </div>
                                    <div className="sp-stat-row">
                                        {stats.filter(s => s.label !== "Eng.rate").map((s) => (
                                            <div key={s.label} className="sp-stat-sm">
                                                <span className="sp-stat-sm-val">{s.value}</span>
                                                <span className="sp-stat-sm-lbl">{s.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="sp-actions">
                                    <Link href="/" className="sp-btn sp-btn--sec">← Tillbaka till topplistan</Link>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                <footer className="sp-footer">
                    © {new Date().getFullYear()} Sociala Raketer &nbsp;·&nbsp;
                    <Link href="/nominera" className="sp-footer-link">Nominera ett konto</Link>
                </footer>
            </main>
        </>
    );
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Jersey+10&family=Montserrat:wght@400;700;900&family=Inter:wght@400;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #64a4c8; color: #222; font-family: 'Inter', system-ui, sans-serif; }

  .sp-root {
    max-width: 900px;
    margin: 0 auto;
    padding: 24px 16px 64px;
    min-height: 100vh;
  }

  .sp-header { margin-bottom: 24px; }

  .sp-wordmark {
    font-family: 'Jersey 10', sans-serif;
    font-size: clamp(2.8rem, 8vw, 5rem);
    font-weight: 400;
    line-height: 1;
    letter-spacing: 0.01em;
    color: #222;
    text-decoration: none;
    display: block;
    margin-bottom: 6px;
  }

  .sp-guld { color: #ffb800; }

  .sp-header-desc {
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #222;
    margin-bottom: 12px;
  }

  .sp-header-rule { height: 1px; background: #222; }

  .sp-state {
    color: rgba(255,255,255,0.7);
    font-size: 13px;
    padding: 40px 0;
    font-family: 'Inter', sans-serif;
  }

  .sp-nav-row {
    display: none;
  }

  .sp-nav-spacer { flex: 1; }

  .sp-nav-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 5px 12px;
    text-decoration: none;
    border: 1px solid rgba(255,255,255,0.5);
    color: #fff;
    background: rgba(255,255,255,0.1);
    white-space: nowrap;
  }

  .sp-nav-btn:hover { background: rgba(255,255,255,0.25); }

  .sp-rank-nav {
    display: flex;
    align-items: center;
    margin: 20px 0 16px;
    gap: 8px;
  }

  .sp-rank-nav-left,
  .sp-rank-nav-right {
    width: 120px;
    flex-shrink: 0;
  }

  .sp-rank-nav-right { display: flex; justify-content: flex-end; }

  .sp-rank-nav-center {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .sp-rank-title {
    font-family: 'Montserrat', sans-serif;
    font-size: 22px;
    font-weight: 900;
    color: #fff;
    line-height: 1;
  }

  .sp-rank-week {
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.65);
    font-family: 'Inter', sans-serif;
  }

  .sp-week {
    display: none;
  }

  .sp-label {
    display: none;
  }

  .sp-card {
    background: #fff;
    border: 1px solid #222;
    box-shadow: 4px 4px 0 #222;
    display: flex;
    gap: 0;
  }

  .sp-thumb-wrap {
    flex-shrink: 0;
    width: 300px;
    position: relative;
    background: #f4f4f4;
  }

  .sp-embed {
    width: 100%;
    aspect-ratio: 9 / 16;
    border: none;
    display: block;
  }

  .sp-play-btn {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 64px;
    height: 64px;
    background: rgba(0,0,0,0.65);
    border: 2px solid #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s;
  }

  .sp-play-btn:hover { background: rgba(0,0,0,0.85); }

  .sp-thumb {
    width: 100%;
    aspect-ratio: 9 / 16;
    object-fit: cover;
    object-position: center top;
    display: block;
  }

  .sp-thumb-placeholder {
    width: 100%;
    aspect-ratio: 9 / 16;
    background: #ddd;
  }

  .sp-tiktok-btn {
    position: absolute;
    bottom: 8px;
    right: 8px;
    background: rgba(0,0,0,0.5);
    color: rgba(255,255,255,0.8);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-decoration: none;
    padding: 4px 8px;
    white-space: nowrap;
  }

  .sp-tiktok-btn:hover { background: rgba(0,0,0,0.75); color: #fff; }

  .sp-info {
    flex: 1;
    min-width: 0;
    padding: 24px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .sp-account { margin-bottom: 24px; }

  .sp-account-name {
    font-family: 'Montserrat', sans-serif;
    font-size: 22px;
    font-weight: 900;
    color: #222;
    text-decoration: none;
    display: block;
    margin-bottom: 4px;
    line-height: 1.2;
  }

  .sp-account-name:hover { text-decoration: underline; }
  .sp-handle { font-size: 12px; color: #999; display: block; margin-bottom: 4px; }
  .sp-followers { font-size: 11px; color: #999; display: block; margin-bottom: 10px; }
  .sp-caption { font-size: 13px; color: #555; line-height: 1.5; }

  .sp-stats {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 24px;
  }

  .sp-stat-er {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 16px 20px;
    background: #ffb800;
    border: 1px solid #222;
  }

  .sp-stat-er-val {
    font-family: 'Montserrat', sans-serif;
    font-size: 42px;
    font-weight: 900;
    color: #222;
    line-height: 1;
  }

  .sp-stat-er-lbl {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(0,0,0,0.5);
    font-family: 'Inter', sans-serif;
  }

  .sp-stat-row {
    display: flex;
    gap: 8px;
  }

  .sp-stat-sm {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 10px 12px;
    background: #f4f4f4;
    border: 1px solid #ddd;
    flex: 1;
  }

  .sp-stat-sm-val {
    font-family: 'Montserrat', sans-serif;
    font-size: 16px;
    font-weight: 700;
    color: #222;
    line-height: 1;
  }

  .sp-stat-sm-lbl {
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #999;
    font-family: 'Inter', sans-serif;
  }

  .sp-actions { display: flex; gap: 8px; flex-wrap: wrap; }

  .sp-btn {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 8px 16px;
    text-decoration: none;
    border: 1px solid #222;
    background: #222;
    color: #fff;
    box-shadow: 2px 2px 0 #999;
  }

  .sp-btn--sec { background: #fff; color: #222; }
  .sp-btn:hover { opacity: 0.85; }

  .sp-footer {
    margin-top: 32px;
    font-size: 9px;
    color: #222;
    letter-spacing: 0.08em;
    border-top: 1px solid #222;
    padding-top: 12px;
    text-transform: uppercase;
    opacity: 0.6;
  }

  .sp-footer-link { color: #222; text-decoration: none; }
  .sp-footer-link:hover { text-decoration: underline; }

  @media (max-width: 640px) {
    .sp-card { flex-direction: column; }
    .sp-thumb-wrap { width: 100%; }
    .sp-info { padding: 16px; }
    .sp-account-name { font-size: 18px; }
    .sp-stat-val { font-size: 18px; }
  }
`;