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
    const rankNum = parseInt((params?.rank ?? "").replace("top", "")) || 0;

    const [video, setVideo] = useState<Video | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

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
                        <div className="sp-meta-row">
                            <span className="sp-week">{weekFmt}</span>
                            <span className="sp-label">{rankLabel(rankNum)}</span>
                        </div>

                        <div className="sp-card">
                            <div className="sp-thumb-wrap">
                                {video.thumbnail_url
                                    ? <img className="sp-thumb" src={video.thumbnail_url} alt={accountName} />
                                    : <div className="sp-thumb-placeholder" />
                                }
                                <a className="sp-tiktok-btn" href={video.video_url} target="_blank" rel="noopener noreferrer">
                                    Se videon på TikTok →
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
                                    {stats.map((s) => (
                                        <div key={s.label} className={`sp-stat${s.label === "Eng.rate" ? " sp-stat--hi" : ""}`}>
                                            <span className="sp-stat-val">{s.value}</span>
                                            <span className="sp-stat-lbl">{s.label}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="sp-actions">
                                    <Link href="/" className="sp-btn sp-btn--sec">← Tillbaka till topplistan</Link>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                <footer className="sp-footer">
                    © {new Date().getFullYear()} Guldraketen &nbsp;·&nbsp;
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

  .sp-meta-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    margin-top: 20px;
  }

  .sp-week {
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.75);
    font-family: 'Inter', sans-serif;
  }

  .sp-label {
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    font-family: 'Montserrat', sans-serif;
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
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    background: #222;
    color: #fff;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-decoration: none;
    padding: 6px 14px;
    white-space: nowrap;
    border: 1px solid rgba(255,255,255,0.2);
  }

  .sp-tiktok-btn:hover { background: #000; }

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
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 24px;
  }

  .sp-stat {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 12px 16px;
    background: #f4f4f4;
    border: 1px solid #ddd;
    flex: 1;
    min-width: 70px;
  }

  .sp-stat--hi { background: #222; border-color: #222; }

  .sp-stat-val {
    font-family: 'Montserrat', sans-serif;
    font-size: 22px;
    font-weight: 900;
    color: #222;
    line-height: 1;
  }

  .sp-stat--hi .sp-stat-val { color: #fff; }

  .sp-stat-lbl {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #999;
    font-family: 'Inter', sans-serif;
  }

  .sp-stat--hi .sp-stat-lbl { color: rgba(255,255,255,0.6); }

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