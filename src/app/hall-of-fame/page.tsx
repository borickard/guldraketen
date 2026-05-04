"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import type { HofVideo, HofWeek } from "@/app/api/tidigare-raketer/route";

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

function rankBg(rank: number): string {
  if (rank === 1) return "#C8962A";
  if (rank === 2) return "#8A9299";
  if (rank === 3) return "#96614A";
  return "rgba(28,27,25,0.75)";
}

function rankColor(rank: number): string {
  if (rank === 1) return "#C8962A";
  if (rank === 2) return "#8A9299";
  if (rank === 3) return "#96614A";
  return "#EBE7E2";
}

function HeartIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
    </svg>
  );
}
function CommentIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3c-4.97 0-9 3.186-9 7.115 0 2.055.999 3.898 2.604 5.207-.141.994-.671 2.716-2.604 3.678 2.132-.142 4.658-1.113 5.922-2.203C9.883 16.943 10.925 17 12 17c4.97 0 9-3.186 9-7.115C21 6.186 16.97 3 12 3z" />
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 17 20 12 15 7" />
      <path d="M4 18v-2a4 4 0 014-4h12" />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function HofCard({ entry }: { entry: HofVideo }) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="gr-vc gr-hof-row-card">
      <a
        href={entry.video.video_url}
        target="_blank"
        rel="noopener noreferrer"
        className="gr-thumb gr-hof-row-thumb"
      >
        {entry.video.thumbnail_url && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.video.thumbnail_url}
            alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, color: "rgba(28,27,25,0.12)" }}>
              {entry.displayName[0]}
            </span>
          </div>
        )}
        <div className="gr-thumb-stats">
          <span><HeartIcon />{fmt(entry.video.likes)}</span>
          <span><CommentIcon />{fmt(entry.video.comments)}</span>
          <span><ShareIcon />{fmt(entry.video.shares)}</span>
          <span><EyeIcon />{fmt(entry.video.views)}</span>
        </div>
        <span className="gr-thumb-er" style={{ color: rankColor(entry.rank) }}>
          {entry.video.engagement_rate.toFixed(2)}%
        </span>
        <span className="gr-thumb-best" style={{ background: rankBg(entry.rank) }}>
          #{entry.rank}
        </span>
      </a>
      <div className="gr-vid-info">
        <a href={`/konto/${entry.handle}`} className="gr-rk-vk-name">
          {entry.displayName}
        </a>
      </div>
    </div>
  );
}

function HallOfFameInner() {
  const [weekGroups, setWeekGroups] = useState<HofWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCat, setSelectedCat] = useState("");

  useEffect(() => {
    fetch("/api/tidigare-raketer")
      .then((r) => r.json())
      .then((d) => { setWeekGroups(d); setLoading(false); });
    fetch("/api/categories")
      .then((r) => r.json())
      .then(setCategories);
  }, []);

  const filtered = useMemo(() => {
    if (!selectedCat) return weekGroups;
    return weekGroups
      .map((g) => ({
        ...g,
        videos: g.videos.filter((v) => v.category === selectedCat),
      }))
      .filter((g) => g.videos.length > 0);
  }, [weekGroups, selectedCat]);

  return (
    <main className="gr-hof-page gr-page">
      <div className="gr-page-hdr gr-hof-hdr">
        <h1 className="gr-page-title">Hall of Fame</h1>
        {categories.length > 0 && (
          <select
            className="gr-calc-cat-select gr-hof-cat-select"
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
          >
            <option value="">Alla kategorier</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="gr-hof-loading">Laddar…</div>
      ) : filtered.length === 0 ? (
        <div className="gr-hof-loading">Inga raketer att visa.</div>
      ) : (
        filtered.map((group) => (
          <div key={group.week} className="gr-hof-week">
            <span className="gr-hof-week-label">{fmtWeek(group.week)}</span>
            <div className="gr-hof-week-row">
              {group.videos.map((entry) => (
                <HofCard key={`${group.week}-${entry.rank}`} entry={entry} />
              ))}
            </div>
          </div>
        ))
      )}
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
