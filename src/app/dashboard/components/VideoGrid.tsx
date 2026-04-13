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

function sorted(videos: Video[], sort: SortKey): Video[] {
  const c = [...videos];
  switch (sort) {
    case "newest":   return c.sort((a, b) => new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime());
    case "oldest":   return c.sort((a, b) => new Date(a.published_at ?? 0).getTime() - new Date(b.published_at ?? 0).getTime());
    case "er":       return c.sort((a, b) => (Number(b.engagement_rate) || 0) - (Number(a.engagement_rate) || 0));
    case "views":    return c.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
    case "likes":    return c.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
    case "comments": return c.sort((a, b) => (b.comments ?? 0) - (a.comments ?? 0));
    case "shares":   return c.sort((a, b) => (b.shares ?? 0) - (a.shares ?? 0));
  }
}

function buildItems(videos: Video[], sort: SortKey): GridItem[] {
  const vids = sorted(videos, sort);

  if (sort !== "newest" && sort !== "oldest") {
    return vids.map((v) => ({ type: "video", video: v }));
  }

  const items: GridItem[] = [];
  let lastWeek = "";

  for (const video of vids) {
    if (video.published_at) {
      const week = toWeekLabel(video.published_at);
      if (week !== lastWeek) {
        items.push({ type: "week", label: week, key: `w-${week}-${video.id}` });
        lastWeek = week;
      }
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

function fmt(n: number | null): string {
  return n != null ? n.toLocaleString("sv-SE") : "—";
}

type Filters = {
  views_min: string; views_max: string;
  likes_min: string; likes_max: string;
  comments_min: string; comments_max: string;
  shares_min: string; shares_max: string;
};

const EMPTY_FILTERS: Filters = {
  views_min: "", views_max: "",
  likes_min: "", likes_max: "",
  comments_min: "", comments_max: "",
  shares_min: "", shares_max: "",
};

function applyFilters(videos: Video[], f: Filters): Video[] {
  return videos.filter((v) => {
    const check = (val: number | null, min: string, max: string) => {
      const n = val ?? 0;
      if (min !== "" && n < Number(min)) return false;
      if (max !== "" && n > Number(max)) return false;
      return true;
    };
    return (
      check(v.views,    f.views_min,    f.views_max)    &&
      check(v.likes,    f.likes_min,    f.likes_max)    &&
      check(v.comments, f.comments_min, f.comments_max) &&
      check(v.shares,   f.shares_min,   f.shares_max)
    );
  });
}

function activeFilterCount(f: Filters): number {
  return Object.values(f).filter((v) => v !== "").length;
}

const FILTER_ROWS: { label: string; min: keyof Filters; max: keyof Filters }[] = [
  { label: "Visningar", min: "views_min",    max: "views_max"    },
  { label: "Likes",     min: "likes_min",    max: "likes_max"    },
  { label: "Komment.",  min: "comments_min", max: "comments_max" },
  { label: "Delningar", min: "shares_min",   max: "shares_max"   },
];

export default function VideoGrid() {
  const [videos, setVideos]   = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort]       = useState<SortKey>("newest");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard/videos")
      .then((r) => r.json())
      .then((data) => { setVideos(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  if (loading) return <p style={{ padding: "2rem 0", color: "#888", fontSize: 14, fontFamily: "Barlow, sans-serif" }}>Laddar videor…</p>;
  if (videos.length === 0) return <p style={{ padding: "2rem 0", color: "#888", fontSize: 14, fontFamily: "Barlow, sans-serif" }}>Inga videor hittades.</p>;

  const filtered = applyFilters(videos, filters);
  const items = buildItems(filtered, sort);
  const nActive = activeFilterCount(filters);

  function setFilter(key: keyof Filters, val: string) {
    setFilters((prev) => ({ ...prev, [key]: val }));
  }

  return (
    <>
      <style>{css}</style>
      <div className="vg-root">

        <div className="vg-toolbar">
          <div className="vg-toolbar-row">
            <span className="vg-row-label">Sortering</span>
            <div className="vg-sorts">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  className={`vg-pill${sort === s.key ? " vg-pill--on" : ""}`}
                  onClick={() => setSort(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="vg-toolbar-row">
            <span className="vg-row-label">Filter</span>
            <button
              className={`vg-pill vg-pill--filter${showFilters ? " vg-pill--on" : ""}${nActive > 0 ? " vg-pill--active" : ""}`}
              onClick={() => setShowFilters((v) => !v)}
            >
              {nActive > 0 ? `${nActive} aktiva` : "Visa filter"}
            </button>
            {nActive > 0 && (
              <button className="vg-filter-clear" onClick={() => setFilters(EMPTY_FILTERS)}>
                Rensa
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="vg-filter-panel">
            {FILTER_ROWS.map((row) => (
              <div key={row.label} className="vg-filter-row">
                <span className="vg-filter-label">{row.label}</span>
                <div className="vg-filter-inputs">
                  <div className="vg-filter-field">
                    <span className="vg-filter-sign">&gt;</span>
                    <input
                      className="vg-filter-input"
                      type="number"
                      min={0}
                      placeholder="min"
                      value={filters[row.min]}
                      onChange={(e) => setFilter(row.min, e.target.value)}
                    />
                  </div>
                  <div className="vg-filter-field">
                    <span className="vg-filter-sign">&lt;</span>
                    <input
                      className="vg-filter-input"
                      type="number"
                      min={0}
                      placeholder="max"
                      value={filters[row.max]}
                      onChange={(e) => setFilter(row.max, e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="vg-grid">
          {items.map((item) => {
            if (item.type === "week") return (
              <div key={item.key} className="vg-week-label">{item.label}</div>
            );

            const v = item.video;
            const er = v.engagement_rate != null ? Number(v.engagement_rate) : null;

            return (
              <div key={v.id} className="vg-card">

                {/* Thumbnail */}
                <a href={v.video_url} target="_blank" rel="noopener noreferrer" className="vg-thumb-wrap">
                  {v.thumbnail_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={v.thumbnail_url} alt="" className="vg-thumb" />
                    : <div className="vg-thumb vg-thumb--empty" />
                  }
                </a>

                {/* ER + link bar */}
                <div className="vg-card-bar">
                  <span className="vg-card-er">
                    {er != null ? `${er.toFixed(2)}%` : "—"}
                  </span>
                  <a
                    href={v.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="vg-card-link"
                    title="Öppna video"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                </div>

                {/* Stats */}
                <div className="vg-stats">
                  {([
                    ["Visningar", fmt(v.views)],
                    ["Likes",     fmt(v.likes)],
                    ["Komment.",  fmt(v.comments)],
                    ["Delningar", fmt(v.shares)],
                  ] as [string, string][]).map(([lbl, val]) => (
                    <div key={lbl} className="vg-stat-row">
                      <span className="vg-stat-lbl">{lbl}</span>
                      <span className="vg-stat-val">{val}</span>
                    </div>
                  ))}
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
    margin-top: 2rem;
    font-family: 'Barlow', sans-serif;
  }

  .vg-toolbar {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
  }

  .vg-toolbar-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .vg-row-label {
    font-family: 'Barlow', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: #888;
    min-width: 64px;
    letter-spacing: 0.03em;
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
    grid-template-columns: repeat(auto-fill, minmax(145px, 1fr));
    gap: 0.75rem 0.75rem;
    align-items: start;
  }

  /* Week label spans full row */
  .vg-week-label {
    grid-column: 1 / -1;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #888;
    padding: 1rem 0 0.25rem;
    border-top: 1px solid rgba(28,27,25,0.12);
    margin-top: 0.25rem;
  }

  .vg-week-label:first-child {
    border-top: none;
    padding-top: 0;
    margin-top: 0;
  }

  /* Card */
  .vg-card {
    display: flex;
    flex-direction: column;
    background: #fff;
    border: 1.5px solid rgba(28,27,25,0.1);
    border-radius: 12px;
    overflow: hidden;
  }

  /* Thumbnail: 4:5 */
  .vg-thumb-wrap {
    aspect-ratio: 4 / 5;
    overflow: hidden;
    background: rgba(28,27,25,0.08);
    flex-shrink: 0;
  }

  .vg-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top;
    display: block;
  }

  .vg-thumb--empty {
    width: 100%;
    height: 100%;
  }

  /* ER + link row */
  .vg-card-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.45rem 0.65rem;
    border-bottom: 1px solid rgba(28,27,25,0.07);
  }

  .vg-card-er {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.05rem;
    font-weight: 700;
    color: #C8962A;
    line-height: 1;
  }

  .vg-card-link {
    display: flex;
    align-items: center;
    color: #E8116A;
    text-decoration: none;
    opacity: 0.75;
    transition: opacity 0.12s;
  }

  .vg-card-link:hover { opacity: 1; }

  /* Stats */
  .vg-stats {
    padding: 0.45rem 0.65rem 0.55rem;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .vg-stat-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.25rem;
  }

  .vg-stat-lbl {
    font-size: 14px;
    color: #999;
    white-space: nowrap;
  }

  .vg-stat-val {
    font-size: 14px;
    font-weight: 700;
    color: #1C1B19;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  /* Filter pill variant */
  .vg-pill--filter { margin-left: 0.25rem; }
  .vg-pill--active:not(.vg-pill--on) {
    border-color: #C8962A;
    color: #C8962A;
  }

  /* Filter panel */
  .vg-filter-panel {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.5rem;
    align-items: center;
    background: #fff;
    border: 1.5px solid rgba(28,27,25,0.1);
    border-radius: 10px;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
  }

  .vg-filter-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .vg-filter-label {
    font-size: 12px;
    color: #888;
    min-width: 56px;
  }

  .vg-filter-inputs {
    display: flex;
    gap: 0.35rem;
  }

  .vg-filter-field {
    display: flex;
    align-items: center;
    gap: 3px;
    background: #f5f4f2;
    border: 1px solid rgba(28,27,25,0.12);
    border-radius: 5px;
    padding: 0 0.4rem;
    height: 28px;
  }

  .vg-filter-sign {
    font-size: 11px;
    color: #aaa;
    line-height: 1;
    user-select: none;
  }

  .vg-filter-input {
    width: 64px;
    background: none;
    border: none;
    outline: none;
    font-family: 'Barlow', sans-serif;
    font-size: 12px;
    color: #1C1B19;
    font-variant-numeric: tabular-nums;
  }

  .vg-filter-input::placeholder { color: #bbb; }

  /* hide number spinners */
  .vg-filter-input::-webkit-outer-spin-button,
  .vg-filter-input::-webkit-inner-spin-button { -webkit-appearance: none; }
  .vg-filter-input[type=number] { -moz-appearance: textfield; }

  .vg-filter-clear {
    font-family: 'Barlow', sans-serif;
    font-size: 11px;
    color: #E8116A;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
`;
