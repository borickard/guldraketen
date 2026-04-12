"use client";

import { useEffect, useState } from "react";

interface Video {
  id: string;
  handle: string;
  video_url: string;
  thumbnail_url: string | null;
  published_at: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  engagement_rate: number | null;
  caption: string | null;
}

type SortKey = "newest" | "oldest" | "er" | "views" | "likes" | "comments" | "shares";

type GridItem =
  | { type: "month"; label: string; key: string }
  | { type: "week"; label: string; key: string }
  | { type: "video"; video: Video };

function toWeekLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil(
    ((d.getTime() - new Date(Date.UTC(year, 0, 1)).getTime()) / 86400000 + 1) / 7
  );
  return `V${week} ${year}`;
}

function toMonthLabel(dateStr: string): string {
  const s = new Date(dateStr).toLocaleDateString("sv-SE", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function sorted(videos: Video[], sort: SortKey): Video[] {
  const c = [...videos];
  switch (sort) {
    case "newest":  return c.sort((a, b) => new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime());
    case "oldest":  return c.sort((a, b) => new Date(a.published_at ?? 0).getTime() - new Date(b.published_at ?? 0).getTime());
    case "er":      return c.sort((a, b) => (Number(b.engagement_rate) || 0) - (Number(a.engagement_rate) || 0));
    case "views":   return c.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
    case "likes":   return c.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
    case "comments":return c.sort((a, b) => (b.comments ?? 0) - (a.comments ?? 0));
    case "shares":  return c.sort((a, b) => (b.shares ?? 0) - (a.shares ?? 0));
  }
}

function buildItems(videos: Video[], sort: SortKey): GridItem[] {
  const vids = sorted(videos, sort);

  if (sort !== "newest" && sort !== "oldest") {
    return vids.map((v) => ({ type: "video", video: v }));
  }

  const items: GridItem[] = [];
  let lastMonth = "";
  let lastWeek = "";

  for (const video of vids) {
    if (!video.published_at) { items.push({ type: "video", video }); continue; }
    const month = toMonthLabel(video.published_at);
    const week  = toWeekLabel(video.published_at);

    if (month !== lastMonth) {
      items.push({ type: "month", label: month, key: `m-${month}` });
      lastMonth = month;
      lastWeek = "";
    }
    if (week !== lastWeek) {
      items.push({ type: "week", label: week, key: `w-${week}` });
      lastWeek = week;
    }
    items.push({ type: "video", video });
  }
  return items;
}

const SORTS: { key: SortKey; label: string }[] = [
  { key: "newest",   label: "Nyaste" },
  { key: "oldest",   label: "Äldsta" },
  { key: "er",       label: "Eng.rate" },
  { key: "views",    label: "Visningar" },
  { key: "likes",    label: "Likes" },
  { key: "comments", label: "Kommentarer" },
  { key: "shares",   label: "Delningar" },
];

export default function VideoGrid() {
  const [videos, setVideos]   = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort]       = useState<SortKey>("newest");
  const [flipped, setFlipped] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/videos")
      .then((r) => r.json())
      .then((data) => { setVideos(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  if (loading) return <p style={{ padding: "2rem 0", color: "#888", fontSize: 14, fontFamily: "Barlow, sans-serif" }}>Laddar videor…</p>;
  if (videos.length === 0) return <p style={{ padding: "2rem 0", color: "#888", fontSize: 14, fontFamily: "Barlow, sans-serif" }}>Inga videor hittades.</p>;

  const items = buildItems(videos, sort);

  return (
    <>
      <style>{css}</style>
      <div className="vg-root">
        <div className="vg-toolbar">
          <h2 className="vg-title">
            Videor <span className="vg-count">{videos.length} st</span>
          </h2>
          <div className="vg-sorts">
            {SORTS.map((s) => (
              <button
                key={s.key}
                className={`vg-pill${sort === s.key ? " vg-pill--on" : ""}`}
                onClick={() => { setSort(s.key); setFlipped(null); }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="vg-grid">
          {items.map((item) => {
            if (item.type === "month") return (
              <div key={item.key} className="vg-divider vg-divider--month">{item.label}</div>
            );
            if (item.type === "week") return (
              <div key={item.key} className="vg-divider vg-divider--week">{item.label}</div>
            );

            const v = item.video;
            const isFlipped = flipped === v.id;
            const er = v.engagement_rate != null ? Number(v.engagement_rate) : null;
            const date = v.published_at ? new Date(v.published_at).toLocaleDateString("sv-SE") : "—";

            return (
              <div key={v.id} className="vg-card" onClick={() => setFlipped(isFlipped ? null : v.id)}>
                <div className={`vg-card-inner${isFlipped ? " vg-card-inner--flipped" : ""}`}>

                  {/* ── Front ── */}
                  <div className="vg-card-front">
                    {v.thumbnail_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={v.thumbnail_url} alt="" className="vg-thumb" />
                      : <div className="vg-thumb vg-thumb--empty" />
                    }
                    <div className="vg-overlay">
                      <span className="vg-overlay-handle">@{v.handle}</span>
                      <span className="vg-overlay-er">
                        {er != null ? `${er.toFixed(2)}%` : "—"}
                      </span>
                    </div>
                  </div>

                  {/* ── Back ── */}
                  <div className="vg-card-back">
                    <div className="vg-back-top">
                      <span className="vg-back-date">{date}</span>
                      <span className="vg-back-er">
                        {er != null ? `${er.toFixed(2)}%` : "—"}
                      </span>
                    </div>
                    <div className="vg-back-er-label">Engagement rate</div>
                    <div className="vg-divider-line" />
                    <div className="vg-metrics">
                      {[
                        { val: v.views,    lbl: "Visningar" },
                        { val: v.likes,    lbl: "Likes" },
                        { val: v.comments, lbl: "Kommentarer" },
                        { val: v.shares,   lbl: "Delningar" },
                      ].map(({ val, lbl }) => (
                        <div key={lbl} className="vg-metric">
                          <span className="vg-metric-val">
                            {val != null ? val.toLocaleString("sv-SE") : "—"}
                          </span>
                          <span className="vg-metric-lbl">{lbl}</span>
                        </div>
                      ))}
                    </div>
                    <a
                      href={v.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="vg-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Visa video
                    </a>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

const css = `
  .vg-root {
    margin-top: 2.5rem;
    font-family: 'Barlow', sans-serif;
  }

  .vg-toolbar {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 1.25rem;
  }

  .vg-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.4rem;
    font-weight: 700;
    color: #1C1B19;
  }

  .vg-count {
    font-family: 'Barlow', sans-serif;
    font-size: 12px;
    font-weight: 400;
    color: #888;
    margin-left: 0.4rem;
  }

  .vg-sorts {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .vg-pill {
    background: transparent;
    border: 1px solid rgba(28,27,25,0.2);
    color: #888;
    font-family: 'Barlow', sans-serif;
    font-size: 11px;
    letter-spacing: 0.05em;
    padding: 0.3rem 0.75rem;
    cursor: pointer;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
    white-space: nowrap;
  }

  .vg-pill--on {
    background: #1C1B19;
    border-color: #1C1B19;
    color: #EDF8FB;
  }

  .vg-pill:not(.vg-pill--on):hover {
    border-color: #1C1B19;
    color: #1C1B19;
  }

  /* Grid */
  .vg-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(175px, 1fr));
    gap: 1rem;
  }

  /* Dividers span full width */
  .vg-divider {
    grid-column: 1 / -1;
    font-family: 'Barlow Condensed', sans-serif;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .vg-divider--month {
    font-size: 1.1rem;
    font-weight: 700;
    color: #1C1B19;
    padding: 1.5rem 0 0.25rem;
    border-top: 2px solid #1C1B19;
    margin-top: 0.5rem;
  }

  .vg-divider--month:first-child {
    border-top: none;
    margin-top: 0;
    padding-top: 0;
  }

  .vg-divider--week {
    font-size: 11px;
    font-weight: 700;
    color: #888;
    padding: 0.5rem 0 0.1rem;
  }

  /* Card */
  .vg-card {
    height: 320px;
    perspective: 1000px;
    cursor: pointer;
  }

  .vg-card-inner {
    position: relative;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    transition: transform 0.4s ease;
  }

  .vg-card-inner--flipped {
    transform: rotateY(180deg);
  }

  .vg-card-front,
  .vg-card-back {
    position: absolute;
    inset: 0;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    overflow: hidden;
  }

  /* Front */
  .vg-card-front {
    background: #1C1B19;
  }

  .vg-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top;
    display: block;
  }

  .vg-thumb--empty {
    background: rgba(28,27,25,0.15);
  }

  .vg-overlay {
    position: absolute;
    inset: auto 0 0 0;
    padding: 2rem 0.75rem 0.75rem;
    background: linear-gradient(to top, rgba(28,27,25,0.88) 0%, transparent 100%);
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .vg-overlay-handle {
    font-size: 11px;
    font-weight: 600;
    color: rgba(237,248,251,0.8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .vg-overlay-er {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.1rem;
    font-weight: 700;
    color: #C8962A;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* Back */
  .vg-card-back {
    transform: rotateY(180deg);
    background: #fff;
    border: 1px solid rgba(28,27,25,0.1);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .vg-back-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .vg-back-date {
    font-size: 11px;
    color: #888;
  }

  .vg-back-er {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.6rem;
    font-weight: 700;
    color: #C8962A;
    line-height: 1;
  }

  .vg-back-er-label {
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #aaa;
    text-align: right;
    margin-top: -4px;
  }

  .vg-divider-line {
    height: 1px;
    background: rgba(28,27,25,0.08);
    margin: 0.25rem 0;
  }

  .vg-metrics {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    flex: 1;
  }

  .vg-metric {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .vg-metric-val {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.1rem;
    font-weight: 700;
    color: #1C1B19;
    line-height: 1;
  }

  .vg-metric-lbl {
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #aaa;
  }

  .vg-link {
    display: block;
    background: #E8116A;
    color: #fff;
    text-align: center;
    text-decoration: none;
    font-family: 'Barlow', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0.5rem;
    transition: background 0.12s;
    margin-top: auto;
  }

  .vg-link:hover { background: #c40d5a; }
`;
