"use client";

import React, { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Account {
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  followers: number | null;
  category: string | null;
  created_at: string;
}

interface VideoRow {
  id: string;
  video_url: string;
  published_at: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number | null;
  thumbnail_url: string | null;
  caption: string | null;
}

interface Stats {
  avgEr: number | null;
  bestEr: number | null;
  videoCount: number;
  firstTracked: string;
  topFinishes: { gold: number; silver: number; bronze: number };
}

type SortKey = "published_at" | "views" | "engagement_rate" | "likes" | "comments" | "shares";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return Math.round(n / 1_000) + "K";
  return String(n);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleDateString("sv-SE", { year: "numeric", month: "short", day: "numeric" });
}

function fmtSince(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("sv-SE", { year: "numeric", month: "long" });
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function KontoPage() {
  const params = useParams();
  const handle = params.handle as string;

  const [account, setAccount] = useState<Account | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("published_at");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    fetch(`/api/konto/${handle}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setAccount(d.account);
        setStats(d.stats);
        setVideos(d.videos);
      })
      .catch(() => setError("Kunde inte ladda kontot."))
      .finally(() => setLoading(false));
  }, [handle]);

  const sorted = useMemo(() => {
    return [...videos].sort((a, b) => {
      let av: number, bv: number;
      if (sortKey === "published_at") {
        av = a.published_at ? new Date(a.published_at).getTime() : 0;
        bv = b.published_at ? new Date(b.published_at).getTime() : 0;
      } else {
        av = Number(a[sortKey] ?? 0);
        bv = Number(b[sortKey] ?? 0);
      }
      return sortAsc ? av - bv : bv - av;
    });
  }, [videos, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
  }

  const displayName = account?.display_name || `@${handle}`;
  const { gold = 0, silver = 0, bronze = 0 } = stats?.topFinishes ?? {};

  return (
    <div className="gr-konto-page">
      <div className="gr-konto-wrap">

        {/* Back link */}
        <a href="/#topplistan" className="gr-konto-back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Tillbaka till topplistan
        </a>

        {loading && <div className="gr-konto-loading">Laddar…</div>}
        {error && <div className="gr-konto-error">{error}</div>}

        {!loading && account && stats && (
          <>
            {/* ── Account header ── */}
            <div className="gr-konto-header">
              <div className="gr-konto-avatar">
                {account.avatar_url ? (
                  <Image
                    src={account.avatar_url}
                    alt={displayName}
                    width={72}
                    height={72}
                    className="gr-konto-avatar-img"
                    unoptimized
                  />
                ) : (
                  <div className="gr-konto-avatar-placeholder">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="gr-konto-header-info">
                <h1 className="gr-konto-name">{displayName}</h1>
                <div className="gr-konto-meta">
                  <span className="gr-konto-handle">@{handle}</span>
                  {account.category && (
                    <span className="gr-konto-category">{account.category}</span>
                  )}
                  {account.followers && account.followers > 0 && (
                    <span className="gr-konto-followers">{fmt(account.followers)} följare</span>
                  )}
                </div>
                <p className="gr-konto-since">Följs sedan {fmtSince(account.created_at)}</p>
              </div>
            </div>

            {/* ── Stat strip ── */}
            <div className="gr-konto-stats">
              {[
                { lbl: "Snitt ER", val: stats.avgEr != null ? `${Number(stats.avgEr).toFixed(2)}%` : "–" },
                { lbl: "Bästa ER", val: stats.bestEr != null ? `${Number(stats.bestEr).toFixed(2)}%` : "–" },
                { lbl: "Inlägg", val: String(stats.videoCount) },
                { lbl: "Topplistor", val: gold + silver + bronze > 0 ? `#1×${gold}  #2×${silver}  #3×${bronze}` : "–" },
              ].map(({ lbl, val }) => (
                <div key={lbl} className="gr-konto-stat">
                  <span className="gr-konto-stat-val">{val}</span>
                  <span className="gr-konto-stat-lbl">{lbl}</span>
                </div>
              ))}
            </div>

            {/* ── Video table ── */}
            <div className="gr-konto-table-wrap">
              <table className="gr-konto-table">
                <thead>
                  <tr>
                    <th className="gr-konto-th gr-konto-th--thumb" />
                    {([
                      { key: "published_at", label: "Datum" },
                      { key: "views", label: "Visningar" },
                      { key: "engagement_rate", label: "ER%" },
                      { key: "likes", label: "Likes" },
                      { key: "comments", label: "Komm." },
                      { key: "shares", label: "Delningar" },
                    ] as { key: SortKey; label: string }[]).map(({ key, label }) => (
                      <th
                        key={key}
                        className={"gr-konto-th" + (sortKey === key ? " active" : "")}
                        onClick={() => toggleSort(key)}
                      >
                        {label}
                        {sortKey === key && (
                          <span className="gr-konto-sort-arrow">{sortAsc ? " ↑" : " ↓"}</span>
                        )}
                      </th>
                    ))}
                    <th className="gr-konto-th" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((v) => (
                    <tr key={v.id} className="gr-konto-row">
                      <td className="gr-konto-td gr-konto-td--thumb">
                        {v.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={v.thumbnail_url} alt="" className="gr-konto-thumb" />
                        ) : (
                          <div className="gr-konto-thumb gr-konto-thumb--empty" />
                        )}
                      </td>
                      <td className="gr-konto-td gr-konto-td--date">{fmtDate(v.published_at)}</td>
                      <td className="gr-konto-td">{fmt(v.views)}</td>
                      <td className="gr-konto-td gr-konto-td--er">
                        {v.engagement_rate != null ? `${Number(v.engagement_rate).toFixed(2)}%` : "–"}
                      </td>
                      <td className="gr-konto-td">{fmt(v.likes)}</td>
                      <td className="gr-konto-td">{fmt(v.comments)}</td>
                      <td className="gr-konto-td">{fmt(v.shares)}</td>
                      <td className="gr-konto-td gr-konto-td--link">
                        <a
                          href={v.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="gr-konto-video-link"
                          aria-label="Öppna video"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

