"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { sv } from "react-day-picker/locale";
import "react-day-picker/style.css";

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
  dateRange: DateRange | undefined;
  views_min: string; views_max: string;
  likes_min: string; likes_max: string;
  comments_min: string; comments_max: string;
  shares_min: string; shares_max: string;
};

const EMPTY_FILTERS: Filters = {
  dateRange: undefined,
  views_min: "", views_max: "",
  likes_min: "", likes_max: "",
  comments_min: "", comments_max: "",
  shares_min: "", shares_max: "",
};

function applyFilters(videos: Video[], f: Filters): Video[] {
  return videos.filter((v) => {
    // Date range
    if (f.dateRange?.from && v.published_at) {
      if (new Date(v.published_at) < f.dateRange.from) return false;
    }
    if (f.dateRange?.to && v.published_at) {
      const toEnd = new Date(f.dateRange.to);
      toEnd.setHours(23, 59, 59, 999);
      if (new Date(v.published_at) > toEnd) return false;
    }
    // Numeric ranges
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
  const numActive = (Object.keys(f) as (keyof Filters)[])
    .filter((k) => k !== "dateRange")
    .filter((k) => f[k] !== "").length;
  const dateActive = f.dateRange?.from ? 1 : 0;
  return numActive + dateActive;
}

type NumericFilterKey = Exclude<keyof Filters, "dateRange">;

const FILTER_ROWS: { label: string; min: NumericFilterKey; max: NumericFilterKey }[] = [
  { label: "Visningar", min: "views_min",    max: "views_max"    },
  { label: "Likes",     min: "likes_min",    max: "likes_max"    },
  { label: "Komment.",  min: "comments_min", max: "comments_max" },
  { label: "Delningar", min: "shares_min",   max: "shares_max"   },
];

export default function VideoGrid({ handle }: { handle?: string }) {
  const [videos, setVideos]   = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort]       = useState<SortKey>("newest");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [showCal, setShowCal] = useState(false);
  const [calPhase, setCalPhase] = useState<0 | 1>(0);
  const [hoverDay, setHoverDay] = useState<Date | undefined>();
  const [urlReady, setUrlReady] = useState(false);
  const calRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    const url = handle ? `/api/dashboard/videos?handle=${encodeURIComponent(handle)}` : "/api/dashboard/videos";
    fetch(url)
      .then((r) => r.json())
      .then((data) => { setVideos(Array.isArray(data) ? data : []); setLoading(false); });
  }, [handle]);

  // Read URL params on mount
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const s = p.get("sort");
    if (s && SORTS.find((x) => x.key === s)) setSort(s as SortKey);
    const df = p.get("date_from");
    const dt = p.get("date_to");
    if (df || dt) {
      setFilters((prev) => ({
        ...prev,
        dateRange: { from: df ? new Date(df) : undefined, to: dt ? new Date(dt) : undefined },
      }));
    }
    const numKeys: NumericFilterKey[] = ["views_min","views_max","likes_min","likes_max","comments_min","comments_max","shares_min","shares_max"];
    const numUpdates: Partial<Filters> = {};
    for (const k of numKeys) { const v = p.get(k); if (v) numUpdates[k] = v; }
    if (Object.keys(numUpdates).length) setFilters((prev) => ({ ...prev, ...numUpdates }));
    if (p.get("filters") === "1") setShowFilters(true);
    setUrlReady(true);
  }, []); // eslint-disable-line

  // Write URL params when state changes (after initial read)
  useEffect(() => {
    if (!urlReady) return;
    const p = new URLSearchParams();
    if (sort !== "newest") p.set("sort", sort);
    if (filters.dateRange?.from) p.set("date_from", filters.dateRange.from.toISOString().split("T")[0]);
    if (filters.dateRange?.to)   p.set("date_to",   filters.dateRange.to.toISOString().split("T")[0]);
    const numKeys: NumericFilterKey[] = ["views_min","views_max","likes_min","likes_max","comments_min","comments_max","shares_min","shares_max"];
    for (const k of numKeys) { if (filters[k]) p.set(k, filters[k] as string); }
    if (showFilters) p.set("filters", "1");
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [sort, filters, showFilters, urlReady]);

  // Close calendar on outside click
  useEffect(() => {
    if (!showCal) return;
    function handler(e: MouseEvent) {
      if (calRef.current && !calRef.current.contains(e.target as Node)) setShowCal(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCal]);

  if (loading) return <p style={{ padding: "2rem 0", color: "#888", fontSize: 14, fontFamily: "Barlow, sans-serif" }}>Laddar videor…</p>;
  if (videos.length === 0) return <p style={{ padding: "2rem 0", color: "#888", fontSize: 14, fontFamily: "Barlow, sans-serif" }}>Inga videor hittades.</p>;

  const filtered = applyFilters(videos, filters);
  const items = buildItems(filtered, sort);
  const nActive = activeFilterCount(filters);

  function setFilter(key: NumericFilterKey, val: string) {
    setFilters((prev) => ({ ...prev, [key]: val }));
  }

  const dateRange = filters.dateRange;

  // While picking end date, show a hover preview range
  const selectedForDisplay: DateRange | undefined = (() => {
    const from = dateRange?.from;
    if (calPhase === 1 && from && hoverDay) {
      return hoverDay < from ? { from: hoverDay, to: from } : { from, to: hoverDay };
    }
    return dateRange;
  })();

  const dateBtnLabel = dateRange?.from
    ? dateRange.to
      ? `${dateRange.from.toLocaleDateString("sv-SE")} – ${dateRange.to.toLocaleDateString("sv-SE")}`
      : dateRange.from.toLocaleDateString("sv-SE")
    : "Välj period";

  return (
    <>
      <style>{css}</style>
      <div className="vg-root">

        <div className="vg-toolbar">
          <div className="vg-toolbar-row">
            <span className="vg-row-label">Sortering och filter</span>
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
            <button
              className={`vg-pill vg-pill--filter${showFilters ? " vg-pill--on" : ""}${nActive > 0 ? " vg-pill--active" : ""}`}
              onClick={() => setShowFilters((v) => !v)}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d="M4 6h16l-7 9.5V21l-2-1v-4.5L4 6z"/>
              </svg>
              {nActive > 0 ? `${nActive} aktiva` : "Filter"}
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
            {/* Date range */}
            <div className="vg-filter-row" style={{ position: "relative" }} ref={calRef}>
              <span className="vg-filter-label">Datum</span>
              <button
                className={`vg-date-btn${dateRange?.from ? " vg-date-btn--active" : ""}`}
                onClick={() => { setShowCal((v) => !v); setCalPhase(0); }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                {dateBtnLabel}
                {dateRange?.from && (
                  <span
                    className="vg-date-clear"
                    role="button"
                    onClick={(e) => { e.stopPropagation(); setFilters((p) => ({ ...p, dateRange: undefined })); setCalPhase(0); setShowCal(false); }}
                    aria-label="Rensa datum"
                  >×</span>
                )}
              </button>
              {showCal && (
                <div className="vg-cal-popup">
                  <div className="vg-cal-header">
                    <span className="vg-cal-title">Välj period</span>
                    <button className="vg-cal-close" onClick={() => setShowCal(false)} aria-label="Stäng">
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/>
                      </svg>
                    </button>
                  </div>
                  <DayPicker
                    mode="range"
                    locale={sv}
                    showOutsideDays
                    selected={selectedForDisplay}
                    onSelect={(_range, selectedDay) => {
                      if (calPhase === 0) {
                        setFilters((p) => ({ ...p, dateRange: { from: selectedDay, to: undefined } }));
                        setCalPhase(1);
                      } else {
                        const from = filters.dateRange?.from ?? selectedDay;
                        const [start, end] = selectedDay >= from ? [from, selectedDay] : [selectedDay, from];
                        setFilters((p) => ({ ...p, dateRange: { from: start, to: end } }));
                        setCalPhase(0);
                        setHoverDay(undefined);
                      }
                    }}
                    onDayMouseEnter={(day) => setHoverDay(day)}
                    onDayMouseLeave={() => setHoverDay(undefined)}
                    numberOfMonths={1}
                  />
                  <div className="vg-cal-footer">
                    <button className="vg-cal-ok" onClick={() => setShowCal(false)}>OK</button>
                  </div>
                </div>
              )}
            </div>
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
    margin-bottom: 1.25rem;
  }

  .vg-toolbar-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .vg-row-label {
    font-family: 'Barlow', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: #888;
    margin-right: 0.25rem;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }

  .vg-sorts {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .vg-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    background: #fff;
    border: 1px solid rgba(28,27,25,0.2);
    color: #1C1B19;
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
    border-color: rgba(28,27,25,0.5);
  }

  /* Grid */
  .vg-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(225px, 1fr));
    gap: 0.75rem 0.75rem;
    align-items: start;
  }

  @media (max-width: 520px) {
    .vg-grid {
      grid-template-columns: repeat(2, 1fr);
    }
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

  /* Date button */
  .vg-date-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: #f5f4f2;
    border: 1px solid rgba(28,27,25,0.15);
    border-radius: 5px;
    padding: 0 0.75rem;
    height: 32px;
    font-family: 'Barlow', sans-serif;
    font-size: 12px;
    color: #888;
    cursor: pointer;
    white-space: nowrap;
    transition: border-color 0.12s, color 0.12s;
  }

  .vg-date-btn--active {
    border-color: #C8962A;
    color: #1C1B19;
  }

  .vg-date-clear {
    margin-left: 2px;
    font-size: 15px;
    line-height: 1;
    color: #aaa;
    cursor: pointer;
    padding: 0 2px;
  }
  .vg-date-clear:hover { color: #E8116A; }

  /* Calendar popup — z-index below sticky header (100) */
  .vg-cal-popup {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 50;
    background: #fff;
    border: 1.5px solid rgba(28,27,25,0.12);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(28,27,25,0.14);
    padding: 0 12px 12px;
  }

  .vg-cal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 2px 4px;
  }

  .vg-cal-title {
    font-family: 'Barlow', sans-serif;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: #aaa;
  }

  .vg-cal-close {
    background: none;
    border: none;
    cursor: pointer;
    color: #aaa;
    display: flex;
    align-items: center;
    padding: 4px;
    border-radius: 4px;
    transition: color 0.12s;
  }
  .vg-cal-close:hover { color: #1C1B19; }

  .vg-cal-footer {
    display: flex;
    justify-content: flex-end;
    padding-top: 8px;
    border-top: 1px solid rgba(28,27,25,0.07);
    margin-top: 4px;
  }

  .vg-cal-ok {
    background: #1C1B19;
    color: #EDF8FB;
    border: none;
    border-radius: 6px;
    font-family: 'Barlow', sans-serif;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    padding: 6px 20px;
    cursor: pointer;
    transition: opacity 0.12s;
  }
  .vg-cal-ok:hover { opacity: 0.85; }

  /* react-day-picker v9 overrides */
  .vg-cal-popup .rdp-root {
    --rdp-accent-color: #1C1B19;
    --rdp-accent-background-color: #1C1B19;
    --rdp-range-start-color: #fff;
    --rdp-range-end-color: #fff;
    --rdp-range-start-background: #1C1B19;
    --rdp-range-end-background: #1C1B19;
    --rdp-range-middle-background-color: rgba(28,27,25,0.1);
    --rdp-range-middle-color: #1C1B19;
    --rdp-selected-border: none;
    --rdp-day-height: 34px;
    --rdp-day-width: 34px;
    --rdp-font-family: 'Barlow', sans-serif;
    font-family: 'Barlow', sans-serif;
    font-size: 13px;
    color: #1C1B19;
  }

  /* Remove bubble borders from each day */
  .vg-cal-popup .rdp-day_button {
    border: none !important;
    border-radius: 6px;
    font-family: 'Barlow', sans-serif;
    font-size: 13px;
    cursor: pointer;
  }

  /* Day hover */
  .vg-cal-popup .rdp-day_button:hover:not([disabled]) {
    background: rgba(28,27,25,0.08);
  }

  /* Range middle days — fill full cell width for continuous highlight */
  .vg-cal-popup .rdp-day.rdp-range_middle {
    background: rgba(28,27,25,0.08);
    border-radius: 0;
  }
  .vg-cal-popup .rdp-day.rdp-range_middle .rdp-day_button {
    background: transparent;
    color: #1C1B19;
  }

  /* Range start */
  .vg-cal-popup .rdp-day.rdp-range_start {
    background: linear-gradient(to right, transparent 50%, rgba(28,27,25,0.08) 50%);
    border-radius: 0;
  }
  .vg-cal-popup .rdp-day.rdp-range_start .rdp-day_button {
    background: #1C1B19;
    color: #fff;
    border-radius: 6px;
  }

  /* Range end */
  .vg-cal-popup .rdp-day.rdp-range_end {
    background: linear-gradient(to left, transparent 50%, rgba(28,27,25,0.08) 50%);
    border-radius: 0;
  }
  .vg-cal-popup .rdp-day.rdp-range_end .rdp-day_button {
    background: #1C1B19;
    color: #fff;
    border-radius: 6px;
  }

  /* Start = end (single day selected) */
  .vg-cal-popup .rdp-day.rdp-range_start.rdp-range_end {
    background: transparent;
  }

  /* Outside days (prev/next month) — visible but dimmed */
  .vg-cal-popup .rdp-day.rdp-outside {
    opacity: 0.35;
  }
  /* Don't dim outside days that are part of the selected range */
  .vg-cal-popup .rdp-day.rdp-outside.rdp-range_middle,
  .vg-cal-popup .rdp-day.rdp-outside.rdp-range_start,
  .vg-cal-popup .rdp-day.rdp-outside.rdp-range_end {
    opacity: 1;
  }

  /* Today marker */
  .vg-cal-popup .rdp-day_button.rdp-today {
    font-weight: 700;
    color: #C8962A;
  }
  .vg-cal-popup .rdp-day.rdp-range_start .rdp-day_button.rdp-today,
  .vg-cal-popup .rdp-day.rdp-range_end .rdp-day_button.rdp-today {
    color: #fff;
  }

  /* Month caption */
  .vg-cal-popup .rdp-month_caption {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #1C1B19;
    padding-bottom: 4px;
  }

  /* Weekday headers */
  .vg-cal-popup .rdp-weekday {
    font-family: 'Barlow', sans-serif;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: #aaa;
    text-transform: uppercase;
  }

  /* Nav buttons */
  .vg-cal-popup .rdp-button_previous,
  .vg-cal-popup .rdp-button_next {
    border: none;
    background: none;
    cursor: pointer;
    color: #888;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    transition: color 0.12s, background 0.12s;
  }
  .vg-cal-popup .rdp-button_previous:hover,
  .vg-cal-popup .rdp-button_next:hover {
    color: #1C1B19;
    background: rgba(28,27,25,0.06);
  }

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
