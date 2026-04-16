"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

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
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1_000) return Math.round(n / 1_000) + "K";
    return String(n);
}

function formatWeek(w: string): string {
    const [year, week] = w.split("-W");
    return `Vecka ${parseInt(week)}, ${year}`;
}

const RANK_LABELS: Record<string, string> = { guld: "Guld", silver: "Silver", brons: "Brons" };
const RANK_COLORS: Record<string, string> = { guld: "#C8962A", silver: "#8A9299", brons: "#96614A" };

export default function VideoSharePage() {
    const params = useParams<{ week: string; rank: string }>();
    const week = params?.week ?? "";
    const rankParam = params?.rank ?? "";
    const rankMap: Record<string, number> = { guld: 1, silver: 2, brons: 3 };
    const rankNum = rankMap[rankParam] ?? (parseInt(rankParam.replace("top", "")) || 0);

    const [video, setVideo] = useState<Video | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [playing, setPlaying] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!week || !rankNum) return;
        fetch(`/api/video?week=${week}&rank=${rankNum}`)
            .then(async (r) => {
                if (!r.ok) {
                    const body = await r.json().catch(() => ({}));
                    throw new Error(body.error ?? "not_found");
                }
                return r.json();
            })
            .then((data) => { setVideo(data); setLoading(false); })
            .catch((e: Error) => { setError(e.message); setLoading(false); });
    }, [week, rankNum]);

    const acct = Array.isArray(video?.accounts) ? video?.accounts[0] : video?.accounts;
    const accountName = acct?.display_name || (video ? `@${video.handle}` : "");
    const followers = acct?.followers ?? 0;
    const er = video?.engagement_rate != null ? Number(video.engagement_rate).toFixed(2) + "%" : "–";
    const rankLabel = RANK_LABELS[rankParam] ?? `Plats ${rankNum}`;
    const rankColor = RANK_COLORS[rankParam] ?? "#EDF8FB";
    const videoId = video?.video_url.match(/\/video\/(\d+)/)?.[1];

    function handleCopy() {
        navigator.clipboard.writeText(window.location.href).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }

    const prevSlug = rankParam === "silver" ? "guld" : rankParam === "brons" ? "silver" : null;
    const nextSlug = rankParam === "guld" ? "silver" : rankParam === "silver" ? "brons" : null;

    return (
        <div className="sp2-root">
            {loading && <p className="sp2-state">Laddar…</p>}
            {error === "not_published_yet" && <p className="sp2-state">Den här veckan är ännu inte publicerad.</p>}
            {error && error !== "not_published_yet" && <p className="sp2-state">Kunde inte ladda videon.</p>}

            {video && (
                <div className="sp2-layout">
                    {/* Thumbnail / embed column */}
                    <div className="sp2-thumb-col">
                        {playing && videoId ? (
                            <iframe
                                className="sp2-embed"
                                src={`https://www.tiktok.com/embed/v2/${videoId}`}
                                allowFullScreen
                                allow="autoplay"
                                scrolling="no"
                            />
                        ) : (
                            <>
                                {video.thumbnail_url
                                    ? <img className="sp2-thumb" src={video.thumbnail_url} alt={accountName} />
                                    : <div className="sp2-thumb-placeholder" />
                                }
                                <button className="sp2-play-btn" onClick={() => setPlaying(true)} aria-label="Spela video">
                                    <svg width="20" height="24" viewBox="0 0 20 24">
                                        <polygon points="2,2 18,12 2,22" fill="#fff" />
                                    </svg>
                                </button>
                            </>
                        )}
                    </div>

                    {/* Info column */}
                    <div className="sp2-info">
                        {/* Rank + week */}
                        <div className="sp2-rank-row">
                            <span className="sp2-rank-badge" style={{ color: rankColor }}>{rankLabel}</span>
                            <span className="sp2-week-label">{formatWeek(week)}</span>
                        </div>

                        {/* Account */}
                        <a
                            className="sp2-account-name"
                            href={`/konto/${video.handle}`}
                        >
                            {accountName}
                        </a>
                        {acct?.display_name && (
                            <span className="sp2-handle">@{video.handle}</span>
                        )}
                        {followers > 0 && (
                            <span className="sp2-followers">{fmt(followers)} följare</span>
                        )}

                        {/* ER hero */}
                        <div className="sp2-er-block">
                            <span className="sp2-er-val" style={{ color: rankColor }}>{er}</span>
                            <span className="sp2-er-lbl">Engagement rate</span>
                        </div>

                        {/* Stats grid */}
                        <div className="sp2-stats">
                            {[
                                { val: fmt(video.likes), lbl: "Likes" },
                                { val: fmt(video.comments), lbl: "Kommentarer" },
                                { val: fmt(video.shares), lbl: "Delningar" },
                                { val: fmt(video.views), lbl: "Visningar" },
                            ].map(({ val, lbl }) => (
                                <div key={lbl} className="sp2-stat">
                                    <span className="sp2-stat-val">{val}</span>
                                    <span className="sp2-stat-lbl">{lbl}</span>
                                </div>
                            ))}
                        </div>

                        {/* Actions */}
                        <div className="sp2-actions">
                            <a
                                href={video.video_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="sp2-btn sp2-btn--primary"
                            >
                                Visa på TikTok
                            </a>
                            <button className="sp2-btn sp2-btn--ghost" onClick={handleCopy}>
                                {copied ? "Kopierad!" : "Kopiera länk"}
                            </button>
                        </div>

                        {/* Rank nav */}
                        <div className="sp2-rank-nav">
                            {prevSlug ? (
                                <a href={`/${week}/${prevSlug}`} className="sp2-nav-link">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
                                    {RANK_LABELS[prevSlug]}
                                </a>
                            ) : <span />}
                            <a href="/#topplistan" className="sp2-nav-home">Topplistan</a>
                            {nextSlug ? (
                                <a href={`/${week}/${nextSlug}`} className="sp2-nav-link">
                                    {RANK_LABELS[nextSlug]}
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
                                </a>
                            ) : <span />}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
