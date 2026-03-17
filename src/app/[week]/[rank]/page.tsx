import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

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
    accounts: { followers: number }[] | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return String(n);
}

function parseRank(rank: string): number | null {
    const m = rank.match(/^top([1-3])$/);
    return m ? parseInt(m[1]) : null;
}

function rankLabel(rank: number): string {
    return rank === 1 ? "🥇 1:a plats" : rank === 2 ? "🥈 2:a plats" : "🥉 3:e plats";
}

function formatWeek(w: string): string {
    const [year, week] = w.split("-W");
    return `Vecka ${parseInt(week)}, ${year}`;
}

function weekBounds(weekStr: string): { start: Date; end: Date } {
    const [yearStr, weekStr2] = weekStr.split("-W");
    const year = parseInt(yearStr);
    const week = parseInt(weekStr2);
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const startOfWeek1 = new Date(jan4);
    startOfWeek1.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
    const start = new Date(startOfWeek1);
    start.setUTCDate(startOfWeek1.getUTCDate() + (week - 1) * 7);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 7);
    return { start, end };
}

async function getVideo(week: string, rank: number): Promise<Video | null> {
    if (!/^\d{4}-W\d{2}$/.test(week)) return null;
    const { start, end } = weekBounds(week);

    const { data, error } = await supabaseAdmin
        .from("videos")
        .select(`
      handle, video_url, published_at, views, likes, comments, shares,
      engagement_rate, thumbnail_url, caption,
      accounts ( followers )
    `)
        .gte("published_at", start.toISOString())
        .lt("published_at", end.toISOString())
        .gte("views", 5000)
        .order("engagement_rate", { ascending: false })
        .limit(3);

    if (error || !data || data.length < rank) return null;
    return data[rank - 1] as unknown as Video;
}

// ─── Metadata (OG) ───────────────────────────────────────────────────────────

export async function generateMetadata({
    params,
}: {
    params: Promise<{ week: string; rank: string }>;
}): Promise<Metadata> {
    const { week, rank: rankParam } = await params;
    const rank = parseRank(rankParam);
    if (!rank) return {};

    const video = await getVideo(week, rank);
    if (!video) return {};

    const label = rankLabel(rank);
    const weekFmt = formatWeek(week);
    const er = video.engagement_rate != null ? video.engagement_rate.toFixed(2) + "%" : "–";

    return {
        title: `${label} ${weekFmt} · @${video.handle} · Guldraketen`,
        description: `${er} engagemangsgrad · ${fmt(video.views)} visningar · ${fmt(video.likes)} likes · ${fmt(video.comments)} kommentarer · ${fmt(video.shares)} delningar. Guldraketen rankar svenska företagskonton på TikTok efter äkta engagemang.`,
        openGraph: {
            title: `${label} ${weekFmt} · @${video.handle}`,
            description: `${er} engagemangsgrad · ${fmt(video.views)} visningar · ${fmt(video.likes)} likes · ${fmt(video.comments)} kommentarer · ${fmt(video.shares)} delningar`,
            url: `https://guldraketen.vercel.app/${week}/${rankParam}`,
            siteName: "Guldraketen",
            images: video.thumbnail_url
                ? [{ url: video.thumbnail_url, width: 720, height: 720, alt: `@${video.handle}` }]
                : [],
        },
    };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function VideoSharePage({
    params,
}: {
    params: Promise<{ week: string; rank: string }>;
}) {
    const { week, rank: rankParam } = await params;
    const rank = parseRank(rankParam);
    if (!rank) notFound();

    const video = await getVideo(week, rank!);
    if (!video) notFound();

    const label = rankLabel(rank!);
    const weekFmt = formatWeek(week);
    const followers = (video.accounts as { followers: number }[] | null)?.[0]?.followers ?? 0;
    const er = video.engagement_rate != null ? video.engagement_rate.toFixed(2) + "%" : "–";

    return (
        <>
            <style>{css}</style>
            <main className="share-root">
                <div className="share-window">
                    <div className="share-titlebar">
                        <span className="share-wbtn">×</span>
                        <span className="share-wbtn">□</span>
                        <span className="share-title">◆ Guldraketen · {weekFmt}</span>
                    </div>

                    <div className="share-body">
                        <div className="share-rank">{label}</div>

                        <div className="share-card">
                            {video.thumbnail_url && (
                                <div className="share-thumb">
                                    <Image
                                        src={video.thumbnail_url}
                                        alt={`@${video.handle}`}
                                        fill
                                        style={{ objectFit: "cover", objectPosition: "center top" }}
                                        unoptimized
                                    />
                                </div>
                            )}
                            <div className="share-info">
                                <div className="share-handle">
                                    <a href={`https://www.tiktok.com/@${video.handle}`} target="_blank" rel="noopener noreferrer">
                                        @{video.handle}
                                    </a>
                                </div>
                                {video.caption && <div className="share-caption">{video.caption}</div>}
                                {followers > 0 && (
                                    <div className="share-meta">{fmt(followers)} followers · {new Date(video.published_at).toLocaleDateString("sv-SE")}</div>
                                )}
                                <div className="share-stats">
                                    <div className="share-stat share-stat--hi">
                                        <span className="share-stat-val">{er}</span>
                                        <span className="share-stat-lbl">Eng.rate</span>
                                    </div>
                                    <div className="share-stat">
                                        <span className="share-stat-val">{fmt(video.views)}</span>
                                        <span className="share-stat-lbl">Views</span>
                                    </div>
                                    <div className="share-stat">
                                        <span className="share-stat-val">{fmt(video.likes)}</span>
                                        <span className="share-stat-lbl">Likes</span>
                                    </div>
                                    <div className="share-stat">
                                        <span className="share-stat-val">{fmt(video.comments)}</span>
                                        <span className="share-stat-lbl">Comments</span>
                                    </div>
                                    <div className="share-stat">
                                        <span className="share-stat-val">{fmt(video.shares)}</span>
                                        <span className="share-stat-lbl">Shares</span>
                                    </div>
                                </div>
                                <div className="share-actions">
                                    <a href={video.video_url} target="_blank" rel="noopener noreferrer" className="share-action-btn">
                                        Se videon på TikTok →
                                    </a>
                                    <Link href="/" className="share-action-btn share-action-btn--sec">
                                        Se hela topplistan
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}

const css = `
  body { background: #64a4c8; margin: 0; font-family: 'Inter', system-ui, sans-serif; }

  .share-root {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
  }

  .share-window {
    background: #fff;
    border: 1px solid #222;
    box-shadow: 4px 4px 0 #222;
    width: 100%;
    max-width: 560px;
  }

  .share-titlebar {
    background: #222;
    color: #fff;
    padding: 5px 8px;
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .share-wbtn {
    width: 13px; height: 13px;
    background: #f4f4f4;
    border: 1px solid rgba(255,255,255,0.2);
    display: flex; align-items: center; justify-content: center;
    font-size: 8px; color: #222;
  }

  .share-title { flex: 1; text-align: center; }

  .share-body { padding: 20px; }

  .share-rank {
    font-size: 20px;
    font-weight: 700;
    margin-bottom: 16px;
    color: #222;
  }

  .share-card {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }

  .share-thumb {
    width: 150px;
    height: 150px;
    flex-shrink: 0;
    position: relative;
    overflow: hidden;
    background: #f4f4f4;
  }

  .share-info { flex: 1; min-width: 0; }

  .share-handle a {
    font-size: 16px;
    font-weight: 700;
    color: #222;
    text-decoration: none;
    display: block;
    margin-bottom: 6px;
  }

  .share-handle a:hover { text-decoration: underline; }

  .share-caption {
    font-size: 12px;
    color: #555;
    line-height: 1.5;
    margin-bottom: 6px;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .share-meta {
    font-size: 10px;
    color: #999;
    margin-bottom: 12px;
  }

  .share-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 16px;
  }

  .share-stat {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 4px 8px;
    background: #f4f4f4;
    border: 1px solid #ddd;
    min-width: 52px;
  }

  .share-stat--hi {
    background: #222;
    border-color: #222;
  }

  .share-stat-val {
    font-size: 13px;
    font-weight: 700;
    color: #222;
  }

  .share-stat--hi .share-stat-val { color: #fff; }

  .share-stat-lbl {
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #999;
  }

  .share-stat--hi .share-stat-lbl { color: rgba(255,255,255,0.6); }

  .share-actions { display: flex; gap: 8px; flex-wrap: wrap; }

  .share-action-btn {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 6px 12px;
    text-decoration: none;
    border: 1px solid #222;
    color: #fff;
    background: #222;
    box-shadow: 2px 2px 0 #999;
  }

  .share-action-btn--sec {
    background: #fff;
    color: #222;
  }

  @media (max-width: 480px) {
    .share-card { flex-direction: column; }
    .share-thumb { width: 100%; height: 200px; }
  }
`;