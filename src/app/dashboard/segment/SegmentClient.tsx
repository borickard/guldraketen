"use client";

import { useEffect, useMemo, useState } from "react";
import { Tag, DEFAULT_TAG_TYPES } from "../components/tagTypes";

// Minimal video shape — segment stats only need the metric fields. Excluded
// videos are dropped from every aggregate, matching the grid's behaviour.
interface Video {
  video_url: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  collect_count: number | null;
  engagement_rate: number | null;
  is_excluded?: boolean | null;
}

interface HandleOpt {
  handle: string;
  display_name: string | null;
}

// Fixed categorical order (Okabe-Ito, CVD-safe — validated with the dataviz
// palette script). Colour follows the segment slot, never its rank, so the
// chart and the table always agree on which colour means which segment.
const SEGMENT_COLORS = ["#0072B2", "#D55E00", "#009E73", "#E69F00", "#CC79A7", "#56B4E9"];
const MAX_SEGMENTS = SEGMENT_COLORS.length;

type SegMode = "tags" | "baseline";
type BaselineKind = "untagged" | "lacksType";

interface SegmentDef {
  id: string;
  name: string;
  nameEdited: boolean;
  mode: SegMode;
  tagIds: string[];              // mode "tags"
  baselineKind: BaselineKind;    // mode "baseline"
  baselineType: string;          // baselineKind "lacksType"
}

interface Stats {
  count: number;
  views: number; likes: number; comments: number; shares: number;
  collects: number; collectsTracked: number;
  avgEr: number | null;
}

function computeStats(videos: Video[]): Stats {
  const vids = videos.filter((v) => !v.is_excluded);
  const sum = (k: keyof Video) => vids.reduce((s, v) => s + Number(v[k] ?? 0), 0);
  const ers = vids
    .map((v) => (v.engagement_rate != null ? Number(v.engagement_rate) : null))
    .filter((n): n is number => n != null && !isNaN(n));
  const collectVids = vids.filter((v) => v.collect_count != null);
  return {
    count: vids.length,
    views: sum("views"), likes: sum("likes"), comments: sum("comments"), shares: sum("shares"),
    collects: collectVids.reduce((s, v) => s + Number(v.collect_count ?? 0), 0),
    collectsTracked: collectVids.length,
    avgEr: ers.length ? ers.reduce((s, n) => s + n, 0) / ers.length : null,
  };
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function emptySegment(): SegmentDef {
  return {
    id: uid(),
    name: "",
    nameEdited: false,
    mode: "tags",
    tagIds: [],
    baselineKind: "untagged",
    baselineType: DEFAULT_TAG_TYPES[0],
  };
}

// A segment only contributes to the comparison once it actually selects
// something: at least one tag, or any baseline (untagged always resolves).
function isDefined(seg: SegmentDef): boolean {
  if (seg.mode === "baseline") return true;
  return seg.tagIds.length > 0;
}

function groupTagsByType(tagIds: string[], tagsById: Map<string, Tag>): Map<string, string[]> {
  const byType = new Map<string, string[]>();
  for (const id of tagIds) {
    const t = tagsById.get(id);
    if (!t) continue;
    (byType.get(t.type) ?? byType.set(t.type, []).get(t.type)!).push(id);
  }
  return byType;
}

// OR within a tag type, AND across types. Baseline segments match by absence.
function matches(videoUrl: string, seg: SegmentDef, videoTags: Record<string, string[]>, tagsById: Map<string, Tag>): boolean {
  const vt = videoTags[videoUrl] ?? [];
  if (seg.mode === "baseline") {
    if (seg.baselineKind === "untagged") return vt.length === 0;
    return !vt.some((id) => tagsById.get(id)?.type === seg.baselineType); // lacks that type
  }
  if (seg.tagIds.length === 0) return false;
  const byType = groupTagsByType(seg.tagIds, tagsById);
  for (const [, ids] of byType) {
    if (!ids.some((id) => vt.includes(id))) return false;
  }
  return byType.size > 0;
}

function autoName(seg: SegmentDef, tagsById: Map<string, Tag>): string {
  if (seg.mode === "baseline") {
    return seg.baselineKind === "untagged" ? "Otaggat" : `Utan ${seg.baselineType}-tagg`;
  }
  if (seg.tagIds.length === 0) return "Nytt segment";
  const byType = groupTagsByType(seg.tagIds, tagsById);
  const parts = [...byType.values()].map((ids) =>
    ids.map((id) => tagsById.get(id)?.name ?? "?").join(" eller ")
  );
  return parts.join(" · ");
}

function displayName(seg: SegmentDef, tagsById: Map<string, Tag>): string {
  return seg.nameEdited && seg.name.trim() ? seg.name.trim() : autoName(seg, tagsById);
}

const nf = (n: number) => Math.round(n).toLocaleString("sv-SE");
const pf = (n: number | null) => (n != null ? `${n.toFixed(2)}%` : "—");

// Chart metric options — one axis, one value per bar.
const CHART_METRICS: { key: string; label: string; get: (s: Stats) => number; fmt: (n: number) => string }[] = [
  { key: "avgEr", label: "Snitt-ER", get: (s) => s.avgEr ?? 0, fmt: (n) => `${n.toFixed(2)}%` },
  { key: "views_avg", label: "Visningar / inlägg", get: (s) => (s.count ? s.views / s.count : 0), fmt: nf },
  { key: "views_total", label: "Visningar totalt", get: (s) => s.views, fmt: nf },
  { key: "likes_avg", label: "Likes / inlägg", get: (s) => (s.count ? s.likes / s.count : 0), fmt: nf },
  { key: "shares_avg", label: "Delningar / inlägg", get: (s) => (s.count ? s.shares / s.count : 0), fmt: nf },
  { key: "collects_avg", label: "Favoriter / inlägg", get: (s) => (s.collectsTracked ? s.collects / s.collectsTracked : 0), fmt: nf },
];

// Table columns — "totavg" cells show total with a per-post average beneath.
type ColKind = "int" | "pct" | "totavg";
const COLUMNS: { key: string; label: string; primary: (s: Stats) => number; kind: ColKind; avg?: (s: Stats) => number }[] = [
  { key: "count", label: "Inlägg", primary: (s) => s.count, kind: "int" },
  { key: "avgEr", label: "Snitt-ER", primary: (s) => s.avgEr ?? 0, kind: "pct" },
  { key: "views", label: "Visningar", primary: (s) => s.views, kind: "totavg", avg: (s) => (s.count ? s.views / s.count : 0) },
  { key: "likes", label: "Likes", primary: (s) => s.likes, kind: "totavg", avg: (s) => (s.count ? s.likes / s.count : 0) },
  { key: "comments", label: "Kommentarer", primary: (s) => s.comments, kind: "totavg", avg: (s) => (s.count ? s.comments / s.count : 0) },
  { key: "shares", label: "Delningar", primary: (s) => s.shares, kind: "totavg", avg: (s) => (s.count ? s.shares / s.count : 0) },
  { key: "collects", label: "Favoriter", primary: (s) => s.collects, kind: "totavg", avg: (s) => (s.collectsTracked ? s.collects / s.collectsTracked : 0) },
];

export default function SegmentClient({ handles }: { handles: HandleOpt[] }) {
  const [activeHandle, setActiveHandle] = useState(handles[0]?.handle ?? "");
  const [videos, setVideos] = useState<Video[]>([]);
  // Loading is derived: the fetched videos belong to `loadedHandle`, so we're
  // loading whenever that lags the active account. This keeps the effect from
  // calling setState synchronously and avoids showing another account's data.
  const [loadedHandle, setLoadedHandle] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [videoTags, setVideoTags] = useState<Record<string, string[]>>({});
  const [segments, setSegments] = useState<SegmentDef[]>([emptySegment(), emptySegment()]);
  const [chartMetric, setChartMetric] = useState("avgEr");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  const knownTypes = useMemo(() => {
    const set = new Set<string>(DEFAULT_TAG_TYPES);
    for (const t of tags) set.add(t.type);
    return [...set];
  }, [tags]);

  const tagsByType = useMemo(() => {
    const byType = new Map<string, Tag[]>();
    for (const t of tags) (byType.get(t.type) ?? byType.set(t.type, []).get(t.type)!).push(t);
    const order = [...DEFAULT_TAG_TYPES, ...[...byType.keys()].filter((t) => !DEFAULT_TAG_TYPES.includes(t)).sort()];
    return order.filter((t) => byType.has(t)).map((type) => ({ type, list: byType.get(type)! }));
  }, [tags]);

  // Tags + tag map are user-wide; fetch once.
  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/tags").then((r) => r.json()).catch(() => []),
      fetch("/api/dashboard/video-tags").then((r) => r.json()).catch(() => ({})),
    ]).then(([t, vt]) => {
      setTags(Array.isArray(t) ? t : []);
      setVideoTags(vt && typeof vt === "object" ? vt : {});
    });
  }, []);

  // Videos are per active account. setState happens only in the async
  // callbacks; a cancel guard drops a stale response if the account changed.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dashboard/videos?handle=${encodeURIComponent(activeHandle)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setVideos(Array.isArray(data) ? data : []);
        setLoadedHandle(activeHandle);
      })
      .catch(() => {
        if (cancelled) return;
        setVideos([]);
        setLoadedHandle(activeHandle);
      });
    return () => { cancelled = true; };
  }, [activeHandle]);

  const loadingVideos = loadedHandle !== activeHandle;

  const defined = segments.filter(isDefined);

  // { seg, color, stats } for every defined segment, in definition order.
  const results = useMemo(() => {
    return defined.map((seg) => {
      const segIndex = segments.findIndex((s) => s.id === seg.id);
      const vids = videos.filter((v) => matches(v.video_url, seg, videoTags, tagsById));
      return {
        seg,
        color: SEGMENT_COLORS[segIndex % SEGMENT_COLORS.length],
        stats: computeStats(vids),
      };
    });
  }, [defined, segments, videos, videoTags, tagsById]);

  const sortedResults = useMemo(() => {
    if (!sortKey) return results;
    const col = COLUMNS.find((c) => c.key === sortKey);
    if (!col) return results;
    const arr = [...results];
    arr.sort((a, b) => {
      const d = col.primary(b.stats) - col.primary(a.stats);
      return sortDir === "desc" ? d : -d;
    });
    return arr;
  }, [results, sortKey, sortDir]);

  const metric = CHART_METRICS.find((m) => m.key === chartMetric) ?? CHART_METRICS[0];
  const chartMax = Math.max(0, ...results.map((r) => metric.get(r.stats)));

  // Best value per table column, for the highlight.
  const bestByCol = useMemo(() => {
    const best: Record<string, number> = {};
    for (const col of COLUMNS) {
      best[col.key] = Math.max(0, ...results.map((r) => col.primary(r.stats)));
    }
    return best;
  }, [results]);

  function updateSeg(id: string, patch: Partial<SegmentDef>) {
    setSegments((cur) => cur.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function toggleTag(id: string, tagId: string) {
    setSegments((cur) =>
      cur.map((s) => {
        if (s.id !== id) return s;
        const has = s.tagIds.includes(tagId);
        return { ...s, tagIds: has ? s.tagIds.filter((t) => t !== tagId) : [...s.tagIds, tagId] };
      })
    );
  }
  function addSegment() {
    setSegments((cur) => (cur.length >= MAX_SEGMENTS ? cur : [...cur, emptySegment()]));
  }
  function removeSegment(id: string) {
    setSegments((cur) => cur.filter((s) => s.id !== id));
  }
  function sortBy(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  return (
    <>
      <style>{css}</style>

      <div className="sg-intro">
        <h1 className="sg-title">Segment</h1>
        <p className="sg-sub">
          Jämför olika delar av ditt innehåll mot varandra — kampanjer, format, teman eller
          otaggat. Samma tagg-typ räknas som <strong>eller</strong>, olika typer som <strong>och</strong>.
        </p>
      </div>

      {handles.length > 1 && (
        <div className="sg-tabs">
          {handles.map((h) => (
            <button
              key={h.handle}
              className={`sg-tab${activeHandle === h.handle ? " sg-tab--on" : ""}`}
              onClick={() => setActiveHandle(h.handle)}
            >
              {h.display_name ?? `@${h.handle}`}
            </button>
          ))}
        </div>
      )}

      {tags.length === 0 ? (
        <p className="sg-empty">
          Du har inga taggar ännu. Tagga inlägg i dashboarden först, så kan du jämföra dem här.
        </p>
      ) : (
        <>
          {/* Segment builder */}
          <div className="sg-builder">
            {segments.map((seg, i) => {
              const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
              return (
                <div key={seg.id} className="sg-card">
                  <div className="sg-card-head">
                    <span className="sg-dot" style={{ background: color }} />
                    <input
                      className="sg-name"
                      value={seg.nameEdited ? seg.name : autoName(seg, tagsById)}
                      onChange={(e) => updateSeg(seg.id, { name: e.target.value, nameEdited: true })}
                      aria-label="Segmentnamn"
                    />
                    {segments.length > 1 && (
                      <button className="sg-remove" onClick={() => removeSegment(seg.id)} aria-label="Ta bort segment">×</button>
                    )}
                  </div>

                  <div className="sg-mode">
                    <button
                      className={`sg-mode-btn${seg.mode === "tags" ? " sg-mode-btn--on" : ""}`}
                      onClick={() => updateSeg(seg.id, { mode: "tags" })}
                    >Taggar</button>
                    <button
                      className={`sg-mode-btn${seg.mode === "baseline" ? " sg-mode-btn--on" : ""}`}
                      onClick={() => updateSeg(seg.id, { mode: "baseline" })}
                    >Baslinje</button>
                  </div>

                  {seg.mode === "tags" ? (
                    <div className="sg-tags">
                      {tagsByType.map(({ type, list }) => (
                        <div key={type} className="sg-tag-group">
                          <span className="sg-tag-type">{type}</span>
                          <div className="sg-tag-chips">
                            {list.map((t) => {
                              const on = seg.tagIds.includes(t.id);
                              const bg = t.color ?? "#8A8A8A";
                              return (
                                <button
                                  key={t.id}
                                  className={`sg-chip${on ? " sg-chip--on" : ""}`}
                                  style={on ? { background: bg, borderColor: bg, color: "#fff" } : { borderColor: bg }}
                                  onClick={() => toggleTag(seg.id, t.id)}
                                >
                                  {on ? "✓ " : ""}{t.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="sg-baseline">
                      <label className="sg-radio">
                        <input
                          type="radio"
                          name={`bl-${seg.id}`}
                          checked={seg.baselineKind === "untagged"}
                          onChange={() => updateSeg(seg.id, { baselineKind: "untagged" })}
                        />
                        Otaggat (inga taggar alls)
                      </label>
                      <label className="sg-radio">
                        <input
                          type="radio"
                          name={`bl-${seg.id}`}
                          checked={seg.baselineKind === "lacksType"}
                          onChange={() => updateSeg(seg.id, { baselineKind: "lacksType" })}
                        />
                        Saknar tagg av typ
                        <select
                          className="sg-select"
                          value={seg.baselineType}
                          disabled={seg.baselineKind !== "lacksType"}
                          onChange={(e) => updateSeg(seg.id, { baselineType: e.target.value })}
                        >
                          {knownTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </label>
                      <p className="sg-baseline-hint">
                        &quot;Saknar kampanj-tagg&quot; = t.ex. always-on-innehåll utan kampanj.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}

            {segments.length < MAX_SEGMENTS && (
              <button className="sg-add" onClick={addSegment}>+ Lägg till segment</button>
            )}
          </div>

          {/* Comparison */}
          {loadingVideos ? (
            <p className="sg-empty">Laddar inlägg…</p>
          ) : defined.length === 0 ? (
            <p className="sg-empty">Välj taggar eller en baslinje ovan för att jämföra segment.</p>
          ) : (
            <div className="sg-compare">
              <div className="sg-chart-head">
                <h2 className="sg-h2">Jämförelse</h2>
                <label className="sg-metric-pick">
                  Visa
                  <select className="sg-select" value={chartMetric} onChange={(e) => setChartMetric(e.target.value)}>
                    {CHART_METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </label>
              </div>

              {/* Bar chart — one axis, one value per segment */}
              <div className="sg-bars" role="img" aria-label={`Stapeldiagram: ${metric.label} per segment`}>
                {results.map((r) => {
                  const val = metric.get(r.stats);
                  const pct = chartMax > 0 ? (val / chartMax) * 100 : 0;
                  return (
                    <div key={r.seg.id} className="sg-bar-row">
                      <span className="sg-bar-label" title={displayName(r.seg, tagsById)}>
                        <span className="sg-dot sg-dot--sm" style={{ background: r.color }} />
                        {displayName(r.seg, tagsById)}
                      </span>
                      <div className="sg-bar-track">
                        <div
                          className="sg-bar-fill"
                          style={{ width: `${Math.max(pct, val > 0 ? 1.5 : 0)}%`, background: r.color }}
                          title={`${displayName(r.seg, tagsById)}: ${metric.fmt(val)} (${r.stats.count} inlägg)`}
                        />
                        <span className="sg-bar-val">{metric.fmt(val)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Table — all metrics, sortable, best per column highlighted */}
              <div className="sg-table-wrap">
                <table className="sg-table">
                  <thead>
                    <tr>
                      <th className="sg-th sg-th--name">Segment</th>
                      {COLUMNS.map((c) => (
                        <th
                          key={c.key}
                          className={`sg-th sg-th--num${sortKey === c.key ? " sg-th--sorted" : ""}`}
                          onClick={() => sortBy(c.key)}
                          title="Sortera"
                        >
                          {c.label}
                          <span className="sg-sort-arrow">
                            {sortKey === c.key ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedResults.map((r) => (
                      <tr key={r.seg.id}>
                        <td className="sg-td sg-td--name">
                          <span className="sg-dot sg-dot--sm" style={{ background: r.color }} />
                          {displayName(r.seg, tagsById)}
                        </td>
                        {COLUMNS.map((c) => {
                          const primary = c.primary(r.stats);
                          const isBest = results.length > 1 && primary > 0 && primary === bestByCol[c.key];
                          return (
                            <td key={c.key} className={`sg-td sg-td--num${isBest ? " sg-td--best" : ""}`}>
                              {c.kind === "pct" ? (
                                <span className="sg-cell-primary">{pf(r.stats.avgEr)}</span>
                              ) : c.kind === "int" ? (
                                <span className="sg-cell-primary">{nf(primary)}</span>
                              ) : (
                                <>
                                  <span className="sg-cell-primary">{nf(primary)}</span>
                                  <span className="sg-cell-avg">{nf(c.avg!(r.stats))} snitt</span>
                                </>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="sg-note">
                Snitt-ER är genomsnittet av varje inläggs engagement rate. Exkluderade inlägg räknas inte med.
                Favoriter visas bara för inlägg där data finns.
              </p>
            </div>
          )}
        </>
      )}
    </>
  );
}

const css = `
  .sg-intro { margin-bottom: 1.5rem; }
  .sg-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 2rem; font-weight: 700; line-height: 1; color: #1C1B19;
    text-transform: uppercase; letter-spacing: 0.02em;
  }
  .sg-sub { font-family: 'Barlow', sans-serif; font-size: 14px; color: #555; margin-top: 0.5rem; max-width: 640px; }
  .sg-sub strong { color: #1C1B19; }

  .sg-tabs { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
  .sg-tab {
    font-family: 'Barlow', sans-serif; font-size: 13px; font-weight: 600;
    padding: 0.4rem 1rem; background: #fff; border: 1.5px solid rgba(28,27,25,0.15);
    border-radius: 6px; color: #888; cursor: pointer;
    transition: border-color 0.12s, color 0.12s, background 0.12s;
  }
  .sg-tab:hover { border-color: rgba(28,27,25,0.4); color: #1C1B19; }
  .sg-tab--on { background: #1C1B19; border-color: #1C1B19; color: #EDF8FB; }

  .sg-empty { font-family: 'Barlow', sans-serif; font-size: 14px; color: #888; padding: 2rem 0; }

  /* Builder */
  .sg-builder {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }
  .sg-card {
    background: #fff; border: 1.5px solid rgba(28,27,25,0.1); border-radius: 12px;
    padding: 1rem; display: flex; flex-direction: column; gap: 0.85rem;
  }
  .sg-card-head { display: flex; align-items: center; gap: 0.5rem; }
  .sg-dot { width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; display: inline-block; }
  .sg-dot--sm { width: 10px; height: 10px; }
  .sg-name {
    flex: 1; font-family: 'Barlow Condensed', sans-serif; font-size: 1.15rem; font-weight: 700;
    color: #1C1B19; background: transparent; border: none; border-bottom: 1.5px solid transparent;
    padding: 2px 0; outline: none;
  }
  .sg-name:focus { border-bottom-color: rgba(28,27,25,0.25); }
  .sg-remove {
    background: none; border: 0; color: #bbb; font-size: 22px; line-height: 1; cursor: pointer;
    width: 26px; height: 26px; border-radius: 4px; flex-shrink: 0;
  }
  .sg-remove:hover { color: #E8116A; background: rgba(232,17,106,0.08); }

  .sg-mode { display: inline-flex; background: rgba(28,27,25,0.06); border-radius: 999px; padding: 3px; align-self: flex-start; }
  .sg-mode-btn {
    font-family: 'Barlow', sans-serif; font-size: 12.5px; font-weight: 500; color: rgba(28,27,25,0.6);
    background: transparent; border: none; padding: 5px 14px; border-radius: 999px; cursor: pointer;
  }
  .sg-mode-btn--on { background: #fff; color: #1C1B19; box-shadow: 0 1px 2px rgba(28,27,25,0.08); }

  .sg-tags { display: flex; flex-direction: column; gap: 0.7rem; }
  .sg-tag-group { display: flex; flex-direction: column; gap: 0.35rem; }
  .sg-tag-type {
    font-size: 10px; letter-spacing: 0.07em; text-transform: uppercase; color: #999; font-weight: 700;
  }
  .sg-tag-chips { display: flex; flex-wrap: wrap; gap: 5px; }
  .sg-chip {
    font-family: 'Barlow', sans-serif; font-size: 12px; font-weight: 600; color: #1C1B19;
    padding: 4px 10px; border-radius: 999px; border: 1.5px solid; background: #fff; cursor: pointer;
    transition: opacity 0.12s;
  }
  .sg-chip:hover { opacity: 0.85; }

  .sg-baseline { display: flex; flex-direction: column; gap: 0.6rem; }
  .sg-radio {
    display: flex; align-items: center; gap: 0.4rem; font-family: 'Barlow', sans-serif;
    font-size: 13.5px; color: #1C1B19; cursor: pointer;
  }
  .sg-baseline-hint { font-family: 'Barlow', sans-serif; font-size: 12px; color: #999; margin: 0; }

  .sg-select {
    font-family: 'Barlow', sans-serif; font-size: 13px; padding: 4px 8px; background: #fff;
    border: 1.5px solid rgba(28,27,25,0.15); border-radius: 5px; color: #1C1B19; cursor: pointer;
  }
  .sg-select:disabled { opacity: 0.5; cursor: default; }

  .sg-add {
    align-self: start; font-family: 'Barlow', sans-serif; font-size: 13px; font-weight: 600;
    color: #1C1B19; background: rgba(28,27,25,0.05); border: 1.5px dashed rgba(28,27,25,0.2);
    border-radius: 12px; padding: 1rem; cursor: pointer; min-height: 60px; width: 100%;
    transition: background 0.12s, border-color 0.12s;
  }
  .sg-add:hover { background: rgba(28,27,25,0.08); border-color: rgba(28,27,25,0.35); }

  /* Comparison */
  .sg-compare {
    background: #fff; border: 1.5px solid rgba(28,27,25,0.1); border-radius: 14px; padding: 1.5rem;
  }
  .sg-chart-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
  .sg-h2 { font-family: 'Barlow Condensed', sans-serif; font-size: 1.4rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #1C1B19; }
  .sg-metric-pick { display: inline-flex; align-items: center; gap: 0.5rem; font-family: 'Barlow', sans-serif; font-size: 13px; color: #888; }

  /* Bars */
  .sg-bars { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 2rem; }
  .sg-bar-row { display: grid; grid-template-columns: 180px 1fr; align-items: center; gap: 0.85rem; }
  .sg-bar-label {
    font-family: 'Barlow', sans-serif; font-size: 13px; font-weight: 600; color: #1C1B19;
    display: flex; align-items: center; gap: 0.4rem;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .sg-bar-track { position: relative; display: flex; align-items: center; gap: 0.5rem; min-height: 22px; }
  .sg-bar-fill { height: 22px; border-radius: 4px; min-width: 2px; transition: width 0.2s; }
  .sg-bar-val { font-family: 'Barlow', sans-serif; font-size: 13px; font-weight: 700; color: #1C1B19; font-variant-numeric: tabular-nums; white-space: nowrap; }

  @media (max-width: 559px) {
    .sg-bar-row { grid-template-columns: 1fr; gap: 0.3rem; }
    .sg-bar-label { max-width: 100%; }
  }

  /* Table */
  .sg-table-wrap { overflow-x: auto; }
  .sg-table { width: 100%; border-collapse: collapse; font-family: 'Barlow', sans-serif; }
  .sg-th {
    font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; color: #888; font-weight: 700;
    padding: 0.5rem 0.65rem; text-align: right; border-bottom: 1.5px solid rgba(28,27,25,0.12);
    cursor: pointer; white-space: nowrap; user-select: none;
  }
  .sg-th--name { text-align: left; }
  .sg-th:hover { color: #1C1B19; }
  .sg-th--sorted { color: #1C1B19; }
  .sg-sort-arrow { color: #C8962A; }
  .sg-td {
    padding: 0.6rem 0.65rem; text-align: right; border-bottom: 1px solid rgba(28,27,25,0.07);
    font-variant-numeric: tabular-nums; color: #1C1B19;
  }
  .sg-td--name { text-align: left; font-weight: 600; white-space: nowrap; display: flex; align-items: center; gap: 0.4rem; }
  .sg-cell-primary { display: block; font-size: 14px; font-weight: 700; }
  .sg-cell-avg { display: block; font-size: 11px; color: #999; margin-top: 1px; }
  .sg-td--best .sg-cell-primary { color: #C8962A; }
  .sg-td--best { background: rgba(200,150,42,0.07); }

  .sg-note { font-family: 'Barlow', sans-serif; font-size: 12px; color: #999; margin-top: 1rem; }
`;
