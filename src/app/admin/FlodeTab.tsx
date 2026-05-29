"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface AccountJoin {
  display_name: string | null;
  avatar_url: string | null;
  category: string | null;
}

interface FeedVideo {
  id: string;
  handle: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  published_at: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  collect_count?: number | null;
  engagement_rate: number | null;
  is_contest: boolean;
  contest_approved: boolean;
  is_hidden: boolean;
  accounts: AccountJoin | AccountJoin[] | null;
}

interface AccountOption {
  handle: string;
  display_name: string | null;
  category: string | null;
}

type SortKey = "published" | "er" | "views" | "likes" | "comments" | "shares" | "collects";
type StatusFilter = "all" | "visible" | "hidden" | "contest";
type Density = 2 | 3 | 4 | 6;

const SORTS: { key: SortKey; label: string }[] = [
  { key: "published", label: "Nyaste" },
  { key: "er", label: "Eng.rate" },
  { key: "views", label: "Visningar" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Kommentarer" },
  { key: "shares", label: "Delningar" },
  { key: "collects", label: "Favoriter" },
];

const STATUSES: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Alla" },
  { key: "visible", label: "Synliga" },
  { key: "hidden", label: "Dolda" },
  { key: "contest", label: "Tävlingar" },
];

const DENSITIES: Density[] = [2, 3, 4, 6];
const PAGE_SIZE = 100;
const DENSITY_KEY = "flode-density";

function getAcct(v: FeedVideo): AccountJoin | null {
  if (!v.accounts) return null;
  return Array.isArray(v.accounts) ? v.accounts[0] ?? null : v.accounts;
}

function shortDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("sv-SE", { year: "numeric", month: "short", day: "numeric" });
}

function fmtCompact(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 10_000) return Math.round(n / 1000) + "k";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return n.toLocaleString("sv-SE");
}

function sortMetric(v: FeedVideo, sort: SortKey): number | null {
  switch (sort) {
    case "published": return v.published_at ? new Date(v.published_at).getTime() : null;
    case "er": return v.engagement_rate;
    case "views": return v.views;
    case "likes": return v.likes;
    case "comments": return v.comments;
    case "shares": return v.shares;
    case "collects": return v.collect_count ?? null;
  }
}

function sortLabelShort(sort: SortKey): string {
  switch (sort) {
    case "er": return "ER";
    case "views": return "visn.";
    case "likes": return "likes";
    case "comments": return "komm.";
    case "shares": return "deln.";
    case "collects": return "fav.";
    default: return "";
  }
}

export default function FlodeTab() {
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const [density, setDensity] = useState<Density>(3);
  const [sort, setSort] = useState<SortKey>("published");
  const [category, setCategory] = useState<string>("");
  const [selectedHandles, setSelectedHandles] = useState<string[]>([]);
  const [status, setStatus] = useState<StatusFilter>("all");

  const [accountList, setAccountList] = useState<AccountOption[]>([]);
  const [handleSearch, setHandleSearch] = useState("");
  const [handleMenuOpen, setHandleMenuOpen] = useState(false);
  const handleBoxRef = useRef<HTMLDivElement>(null);

  // Restore density from localStorage
  useEffect(() => {
    try {
      const v = parseInt(localStorage.getItem(DENSITY_KEY) ?? "", 10);
      if ([2, 3, 4, 6].includes(v)) setDensity(v as Density);
    } catch {}
  }, []);

  function setDensityPersisted(d: Density) {
    setDensity(d);
    try { localStorage.setItem(DENSITY_KEY, String(d)); } catch {}
  }

  // Fetch the full handle/category list once for filter dropdowns
  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data: AccountOption[]) => {
        if (Array.isArray(data)) {
          setAccountList(
            data
              .map((a) => ({ handle: a.handle, display_name: a.display_name, category: a.category }))
              .sort((a, b) => a.handle.localeCompare(b.handle, "sv"))
          );
        }
      })
      .catch(() => {});
  }, []);

  // Close handle dropdown on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!handleBoxRef.current?.contains(e.target as Node)) setHandleMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const a of accountList) if (a.category) set.add(a.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "sv"));
  }, [accountList]);

  const fetchPage = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          offset: String(nextOffset),
          limit: String(PAGE_SIZE),
          sort,
          status,
        });
        if (category) params.set("category", category);
        if (selectedHandles.length > 0) params.set("handles", selectedHandles.join(","));
        const res = await fetch(`/api/admin/floden?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: FeedVideo[] = await res.json();
        setVideos((curr) => (nextOffset === 0 ? data : [...curr, ...data]));
        setOffset(nextOffset + data.length);
        setHasMore(data.length === PAGE_SIZE);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Okänt fel");
      } finally {
        setLoading(false);
        setInitialLoad(false);
      }
    },
    [sort, status, category, selectedHandles]
  );

  // Refetch from start when filters/sort change
  useEffect(() => {
    setOffset(0);
    setVideos([]);
    setHasMore(true);
    fetchPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, status, category, selectedHandles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length === 0) return videos;
    return videos.filter((v) => {
      const a = getAcct(v);
      const fields = [
        v.handle,
        v.caption ?? "",
        a?.display_name ?? "",
        a?.category ?? "",
      ];
      return fields.some((f) => f.toLowerCase().includes(q));
    });
  }, [videos, search]);

  async function toggleField(v: FeedVideo, field: "is_contest" | "is_hidden") {
    if (savingId) return;
    setSavingId(v.id);
    const next = !v[field];
    setVideos((curr) =>
      curr.map((x) => {
        if (x.id !== v.id) return x;
        if (field === "is_contest") {
          return { ...x, is_contest: next, contest_approved: next ? x.contest_approved : false };
        }
        return { ...x, is_hidden: next };
      })
    );
    try {
      const res = await fetch("/api/admin/floden", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: v.id, [field]: next }),
      });
      if (!res.ok) throw new Error("Update failed");
    } catch {
      setVideos((curr) =>
        curr.map((x) =>
          x.id === v.id
            ? { ...x, is_contest: v.is_contest, contest_approved: v.contest_approved, is_hidden: v.is_hidden }
            : x
        )
      );
      alert("Kunde inte uppdatera.");
    } finally {
      setSavingId(null);
    }
  }

  function toggleHandle(h: string) {
    setSelectedHandles((curr) =>
      curr.includes(h) ? curr.filter((x) => x !== h) : [...curr, h]
    );
  }

  const visibleHandles = useMemo(() => {
    const q = handleSearch.trim().toLowerCase();
    let list = accountList;
    if (category) list = list.filter((a) => a.category === category);
    if (q.length > 0) {
      list = list.filter(
        (a) =>
          a.handle.toLowerCase().includes(q) ||
          (a.display_name ?? "").toLowerCase().includes(q)
      );
    }
    return list.slice(0, 60);
  }, [accountList, handleSearch, category]);

  const showSortMetric = sort !== "published";

  return (
    <div className="admin-section flode-section">
      <style>{css}</style>

      <div className="flode-bar">
        <div className="flode-bar-row">
          <span className="flode-bar-label">Sortera</span>
          <div className="flode-pills">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`flode-pill${sort === s.key ? " flode-pill--on" : ""}`}
                onClick={() => setSort(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flode-bar-row">
          <span className="flode-bar-label">Status</span>
          <div className="flode-pills">
            {STATUSES.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`flode-pill${status === s.key ? " flode-pill--on" : ""}`}
                onClick={() => setStatus(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flode-bar-row flode-bar-row--filters">
          <select
            className="flode-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filtrera kategori"
          >
            <option value="">Alla kategorier</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <div className="flode-handles" ref={handleBoxRef}>
            <div className="flode-handles-input">
              {selectedHandles.map((h) => (
                <span key={h} className="flode-chip">
                  {h}
                  <button
                    type="button"
                    className="flode-chip-x"
                    onClick={() => toggleHandle(h)}
                    aria-label={`Ta bort ${h}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                placeholder={selectedHandles.length === 0 ? "Filtrera konto…" : ""}
                value={handleSearch}
                onChange={(e) => { setHandleSearch(e.target.value); setHandleMenuOpen(true); }}
                onFocus={() => setHandleMenuOpen(true)}
                className="flode-handles-search"
              />
            </div>
            {handleMenuOpen && visibleHandles.length > 0 && (
              <div className="flode-handles-menu">
                {visibleHandles.map((a) => {
                  const on = selectedHandles.includes(a.handle);
                  return (
                    <button
                      key={a.handle}
                      type="button"
                      className={`flode-handles-opt${on ? " flode-handles-opt--on" : ""}`}
                      onClick={() => { toggleHandle(a.handle); setHandleSearch(""); }}
                    >
                      <span className="flode-handles-name">{a.display_name ?? a.handle}</span>
                      <span className="flode-handles-meta">
                        @{a.handle}{a.category ? ` · ${a.category}` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flode-density">
            <span className="flode-density-label">Per rad</span>
            {DENSITIES.map((d) => (
              <button
                key={d}
                type="button"
                className={`flode-density-btn${density === d ? " flode-density-btn--on" : ""}`}
                onClick={() => setDensityPersisted(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="flode-bar-row flode-bar-row--meta">
          <input
            type="text"
            className="flode-search"
            placeholder="Sök på handle, namn, caption eller kategori…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flode-count">
            {initialLoad
              ? "Laddar…"
              : search
              ? `${filtered.length} av ${videos.length} laddade`
              : `${videos.length} inlägg laddade`}
          </div>
        </div>
      </div>

      {error && <div className="flode-error">Kunde inte ladda flödet: {error}</div>}

      <div
        className="flode-grid"
        style={{ gridTemplateColumns: `repeat(${density}, minmax(0, 1fr))` }}
      >
        {filtered.map((v) => {
          const acct = getAcct(v);
          const isSaving = savingId === v.id;
          const metricVal = showSortMetric ? sortMetric(v, sort) : null;
          const metricFormatted =
            sort === "er"
              ? v.engagement_rate != null
                ? `${Number(v.engagement_rate).toFixed(2)}%`
                : "—"
              : metricVal != null
              ? fmtCompact(metricVal as number)
              : "—";
          return (
            <article
              key={v.id}
              className={[
                "flode-card",
                v.is_contest ? "flode-card--contest" : "",
                v.is_hidden ? "flode-card--hidden" : "",
              ].filter(Boolean).join(" ")}
            >
              <a href={v.video_url} target="_blank" rel="noreferrer" className="flode-thumb-link">
                {v.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumbnail_url} alt="" className="flode-thumb" loading="lazy" />
                ) : (
                  <div className="flode-thumb flode-thumb--empty" />
                )}
                <div className="flode-thumb-tags">
                  {v.is_contest && <span className="flode-badge flode-badge--contest">Tävling</span>}
                  {v.is_hidden && <span className="flode-badge flode-badge--hidden">Dold</span>}
                </div>
                {v.engagement_rate != null && (
                  <span className="flode-er-chip">
                    {Number(v.engagement_rate).toFixed(2)}%
                  </span>
                )}
                {showSortMetric && (
                  <span className="flode-sort-chip" title={`Sortering: ${sortLabelShort(sort)}`}>
                    {metricFormatted}
                  </span>
                )}
              </a>
              <div className="flode-body">
                <div className="flode-caption">{v.caption || <em>(ingen caption)</em>}</div>
                <div className="flode-meta">
                  <span className="flode-handle">@{v.handle}</span>
                  {acct?.category && <span className="flode-cat">{acct.category}</span>}
                  <span className="flode-date">{shortDate(v.published_at)}</span>
                </div>
                <div className="flode-actions">
                  <button
                    type="button"
                    className={`flode-toggle flode-toggle--hide${v.is_hidden ? " flode-toggle--on" : ""}`}
                    disabled={isSaving}
                    onClick={() => toggleField(v, "is_hidden")}
                  >
                    {v.is_hidden ? "Visa" : "Dölj"}
                  </button>
                  <button
                    type="button"
                    className={`flode-toggle flode-toggle--contest${v.is_contest ? " flode-toggle--on" : ""}`}
                    disabled={isSaving}
                    onClick={() => toggleField(v, "is_contest")}
                  >
                    {v.is_contest ? "Avflagga tävling" : "Tävling"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
        {!initialLoad && filtered.length === 0 && (
          <div className="flode-empty">
            {search
              ? "Inga inlägg matchar sökningen."
              : "Inga inlägg matchar dina filter."}
          </div>
        )}
      </div>

      {hasMore && !search && (
        <div className="flode-more-row">
          <button
            type="button"
            className="flode-more-btn"
            disabled={loading}
            onClick={() => fetchPage(offset)}
          >
            {loading ? "Laddar…" : `Ladda ${PAGE_SIZE} fler`}
          </button>
        </div>
      )}

      {hasMore && search && (
        <p className="flode-note">
          Sökning körs bara mot de {videos.length} laddade inläggen. Ladda fler för att utöka.
        </p>
      )}
    </div>
  );
}

const css = `
  .flode-section { padding-top: 0; }

  .flode-bar {
    background: #fff;
    border: 1px solid rgba(28,27,25,0.1);
    border-radius: 6px;
    padding: 0.9rem 1rem;
    margin-bottom: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }

  .flode-bar-row {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    flex-wrap: wrap;
  }

  .flode-bar-row--filters { gap: 0.6rem; }
  .flode-bar-row--meta { gap: 1rem; }

  .flode-bar-label {
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(28,27,25,0.55);
    font-weight: 600;
    min-width: 60px;
  }

  .flode-pills {
    display: flex;
    gap: 0.3rem;
    flex-wrap: wrap;
  }

  .flode-pill {
    font-family: 'Barlow', sans-serif;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.03em;
    padding: 0.35rem 0.75rem;
    background: #fff;
    border: 1.5px solid rgba(28,27,25,0.15);
    border-radius: 999px;
    color: #888;
    cursor: pointer;
    transition: border-color 0.12s, color 0.12s, background 0.12s;
  }

  .flode-pill:hover {
    border-color: rgba(28,27,25,0.4);
    color: #1C1B19;
  }

  .flode-pill--on {
    background: #1C1B19;
    border-color: #1C1B19;
    color: #EDF8FB;
  }
  .flode-pill--on:hover {
    border-color: #1C1B19;
    color: #EDF8FB;
  }

  .flode-select {
    font-family: 'Barlow', sans-serif;
    font-size: 13px;
    padding: 0.45rem 0.7rem;
    background: #fff;
    border: 1.5px solid rgba(28,27,25,0.15);
    border-radius: 4px;
    color: #1C1B19;
    outline: none;
    min-width: 180px;
    cursor: pointer;
  }
  .flode-select:focus { border-color: #1C1B19; }

  .flode-handles {
    position: relative;
    flex: 1;
    min-width: 240px;
    max-width: 460px;
  }
  .flode-handles-input {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    background: #fff;
    border: 1.5px solid rgba(28,27,25,0.15);
    border-radius: 4px;
    padding: 4px 6px;
    min-height: 36px;
  }
  .flode-handles-input:focus-within { border-color: #1C1B19; }

  .flode-chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    background: #1C1B19;
    color: #EDF8FB;
    font-family: 'Barlow', sans-serif;
    font-size: 11.5px;
    padding: 2px 4px 2px 8px;
    border-radius: 3px;
  }
  .flode-chip-x {
    background: none;
    border: 0;
    color: rgba(237,248,251,0.7);
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 0 4px;
  }
  .flode-chip-x:hover { color: #EDF8FB; }

  .flode-handles-search {
    flex: 1;
    min-width: 100px;
    border: 0;
    outline: none;
    background: transparent;
    font-family: 'Barlow', sans-serif;
    font-size: 13px;
    color: #1C1B19;
    padding: 2px 4px;
  }

  .flode-handles-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: #fff;
    border: 1px solid rgba(28,27,25,0.15);
    border-radius: 4px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.08);
    max-height: 280px;
    overflow-y: auto;
    z-index: 30;
  }
  .flode-handles-opt {
    display: flex;
    flex-direction: column;
    width: 100%;
    padding: 0.4rem 0.65rem;
    background: transparent;
    border: 0;
    border-bottom: 1px solid rgba(28,27,25,0.06);
    cursor: pointer;
    text-align: left;
    font: inherit;
  }
  .flode-handles-opt:last-child { border-bottom: 0; }
  .flode-handles-opt:hover { background: rgba(28,27,25,0.04); }
  .flode-handles-opt--on { background: rgba(200,150,42,0.08); }
  .flode-handles-name {
    font-size: 13px;
    font-weight: 600;
    color: #1C1B19;
  }
  .flode-handles-meta {
    font-size: 11px;
    color: #888;
    margin-top: 1px;
  }

  .flode-density {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
  }
  .flode-density-label {
    font-size: 11px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: rgba(28,27,25,0.55);
    font-weight: 600;
    margin-right: 4px;
  }
  .flode-density-btn {
    background: #fff;
    border: 1.5px solid rgba(28,27,25,0.15);
    color: #888;
    font-family: 'Barlow', sans-serif;
    font-size: 12px;
    font-weight: 600;
    width: 30px;
    height: 30px;
    border-radius: 4px;
    cursor: pointer;
    transition: border-color 0.12s, color 0.12s, background 0.12s;
  }
  .flode-density-btn:hover { border-color: rgba(28,27,25,0.4); color: #1C1B19; }
  .flode-density-btn--on {
    background: #1C1B19;
    border-color: #1C1B19;
    color: #EDF8FB;
  }

  .flode-search {
    flex: 1;
    min-width: 240px;
    font-family: 'Barlow', sans-serif;
    font-size: 13px;
    padding: 0.5rem 0.8rem;
    background: #fff;
    border: 1.5px solid rgba(28,27,25,0.15);
    border-radius: 4px;
    color: #1C1B19;
    outline: none;
    transition: border-color 0.12s;
  }
  .flode-search:focus { border-color: #1C1B19; }

  .flode-count {
    font-size: 11px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: rgba(28,27,25,0.55);
  }

  .flode-error {
    background: #fff3f3;
    border: 1px solid #f4caca;
    color: #b03030;
    padding: 0.75rem 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
    font-size: 13px;
  }

  .flode-grid {
    display: grid;
    gap: 1rem;
  }

  @media (max-width: 720px) {
    .flode-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }
  }
  @media (max-width: 480px) {
    .flode-grid {
      grid-template-columns: 1fr !important;
    }
  }

  .flode-empty {
    grid-column: 1 / -1;
    padding: 3rem 1rem;
    text-align: center;
    color: rgba(28,27,25,0.55);
    font-size: 14px;
  }

  .flode-card {
    background: #fff;
    border: 1.5px solid rgba(28,27,25,0.1);
    border-radius: 6px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: border-color 0.12s, opacity 0.12s;
  }
  .flode-card:hover { border-color: rgba(28,27,25,0.25); }
  .flode-card--contest {
    border-color: #C8962A;
    background: #fffaf0;
  }
  .flode-card--hidden {
    opacity: 0.65;
    background: rgba(28,27,25,0.04);
  }
  .flode-card--hidden:hover { opacity: 0.85; }

  .flode-thumb-link {
    position: relative;
    display: block;
    aspect-ratio: 9/16;
    background: #f0ece6;
    overflow: hidden;
  }

  .flode-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    display: block;
  }
  .flode-thumb--empty { background: #f0ece6; }

  .flode-thumb-tags {
    position: absolute;
    top: 6px;
    left: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-start;
  }
  .flode-badge {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 3px 7px;
    border-radius: 2px;
    color: #fff;
  }
  .flode-badge--contest { background: #C8962A; }
  .flode-badge--hidden { background: #4f4d48; }

  .flode-er-chip {
    position: absolute;
    bottom: 6px;
    right: 6px;
    background: rgba(28,27,25,0.85);
    color: #EDF8FB;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px;
    font-weight: 700;
    padding: 3px 7px;
    border-radius: 3px;
    line-height: 1;
  }

  .flode-sort-chip {
    position: absolute;
    bottom: 6px;
    left: 6px;
    background: rgba(200,150,42,0.92);
    color: #1C1B19;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px;
    font-weight: 700;
    padding: 3px 7px;
    border-radius: 3px;
    line-height: 1;
  }

  .flode-body {
    padding: 0.7rem 0.75rem 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .flode-caption {
    font-size: 12.5px;
    line-height: 1.4;
    color: #1C1B19;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    min-height: calc(1.4em * 3);
  }
  .flode-caption em { color: rgba(28,27,25,0.4); font-style: italic; }

  .flode-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 11px;
    color: rgba(28,27,25,0.55);
  }
  .flode-handle { font-weight: 600; color: #1C1B19; }
  .flode-cat {
    background: rgba(28,27,25,0.06);
    padding: 1px 6px;
    border-radius: 2px;
    font-size: 10px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .flode-date { margin-left: auto; }

  .flode-actions {
    display: flex;
    gap: 5px;
  }

  .flode-toggle {
    font-family: 'Barlow', sans-serif;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.03em;
    padding: 0.45rem 0.55rem;
    border: 0;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.12s, opacity 0.12s;
    flex: 1;
  }
  .flode-toggle:disabled { opacity: 0.6; cursor: default; }

  .flode-toggle--hide {
    background: #1C1B19;
    color: #EDF8FB;
  }
  .flode-toggle--hide:hover:not(:disabled) { background: #2a2926; }
  .flode-toggle--hide.flode-toggle--on {
    background: #fff;
    color: #4f4d48;
    border: 1.5px solid #4f4d48;
    padding: calc(0.45rem - 1.5px) calc(0.55rem - 1.5px);
  }
  .flode-toggle--hide.flode-toggle--on:hover:not(:disabled) {
    background: rgba(79,77,72,0.06);
  }

  .flode-toggle--contest {
    background: #fff;
    color: #C8962A;
    border: 1.5px solid #C8962A;
    padding: calc(0.45rem - 1.5px) calc(0.55rem - 1.5px);
  }
  .flode-toggle--contest:hover:not(:disabled) {
    background: #fff5e3;
  }
  .flode-toggle--contest.flode-toggle--on {
    background: #C8962A;
    color: #fff;
    border-color: #C8962A;
  }
  .flode-toggle--contest.flode-toggle--on:hover:not(:disabled) {
    background: #b18222;
  }

  .flode-more-row {
    display: flex;
    justify-content: center;
    padding: 1.75rem 0 1rem;
  }
  .flode-more-btn {
    font-family: 'Barlow', sans-serif;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.04em;
    padding: 0.6rem 1.4rem;
    background: #fff;
    border: 1.5px solid rgba(28,27,25,0.2);
    border-radius: 4px;
    color: #1C1B19;
    cursor: pointer;
    transition: border-color 0.12s, background 0.12s;
  }
  .flode-more-btn:hover:not(:disabled) {
    border-color: #1C1B19;
    background: rgba(28,27,25,0.04);
  }
  .flode-more-btn:disabled { opacity: 0.6; cursor: default; }

  .flode-note {
    margin: 1rem 0 0;
    padding: 0.6rem 0.9rem;
    background: rgba(28,27,25,0.04);
    border-left: 3px solid rgba(28,27,25,0.2);
    font-size: 12px;
    color: rgba(28,27,25,0.65);
    border-radius: 0 4px 4px 0;
  }
`;
