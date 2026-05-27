"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AccountPicker from "./AccountPicker";

interface OwnHandle {
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface CompareRow {
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  category: string | null;
  followers: number | null;
  is_self: boolean;
  period: { days: number | null; video_count: number };
  benchmarks: {
    avg_er: number | null;
    avg_views: number | null;
    avg_likes: number | null;
    avg_comments: number | null;
    avg_shares: number | null;
    avg_collects: number | null;
    total_views: number;
    total_likes: number;
    total_comments: number;
    total_shares: number;
    total_collects: number;
    posts_per_week: number | null;
  };
}

type Period = "30d" | "90d" | "all";

const PERIODS: { value: Period; label: string }[] = [
  { value: "30d", label: "30 dagar" },
  { value: "90d", label: "90 dagar" },
  { value: "all", label: "Allt" },
];

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("sv-SE");
}

function fmtCompact(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 10_000) return Math.round(n / 1000) + "k";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return n.toLocaleString("sv-SE");
}

function parseUrlHandles(): string[] | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const h = params.get("handles");
  if (!h) return null;
  return h.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
}

function parseUrlPeriod(): Period | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const p = params.get("period");
  if (p === "30d" || p === "90d" || p === "all") return p;
  return null;
}

export default function CompareClient({
  ownHandles,
  initialSavedHandles,
}: {
  ownHandles: OwnHandle[];
  initialSavedHandles: string[];
}) {
  const ownHandleSet = useMemo(() => new Set(ownHandles.map((h) => h.handle)), [ownHandles]);
  const ownHandlesList = useMemo(() => ownHandles.map((h) => h.handle), [ownHandles]);

  const [extraHandles, setExtraHandles] = useState<string[]>(initialSavedHandles);
  const [period, setPeriod] = useState<Period>("30d");
  const [rows, setRows] = useState<CompareRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Picker modal state
  const [pickerOpen, setPickerOpen] = useState(false);

  // Read URL state on first mount
  useEffect(() => {
    const urlHandles = parseUrlHandles();
    const urlPeriod = parseUrlPeriod();
    if (urlHandles) {
      const extras = urlHandles.filter((h) => !ownHandleSet.has(h));
      setExtraHandles(extras);
    }
    if (urlPeriod) setPeriod(urlPeriod);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allHandles = useMemo(
    () => [...ownHandlesList, ...extraHandles.filter((h) => !ownHandleSet.has(h))],
    [ownHandlesList, extraHandles, ownHandleSet]
  );

  // Sync URL when state changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (allHandles.length > 0) {
      params.set("handles", allHandles.join(","));
    } else {
      params.delete("handles");
    }
    params.set("period", period);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", newUrl);
  }, [allHandles, period]);

  // Fetch comparison data
  useEffect(() => {
    if (allHandles.length === 0) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(
      `/api/dashboard/compare?handles=${encodeURIComponent(allHandles.join(","))}&period=${period}`
    )
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: CompareRow[]) => {
        if (!cancelled) setRows(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [allHandles, period]);

  const persistHandles = useCallback((handles: string[]) => {
    fetch("/api/dashboard/compare-handles", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handles }),
    }).catch(() => {});
  }, []);


  const addHandle = useCallback(
    (handle: string) => {
      const h = handle.trim().toLowerCase();
      if (!h) return;
      if (ownHandleSet.has(h)) return;
      setExtraHandles((curr) => {
        if (curr.includes(h)) return curr;
        const next = [...curr, h];
        persistHandles(next);
        return next;
      });
      setPickerOpen(false);
    },
    [ownHandleSet, persistHandles]
  );

  const removeHandle = useCallback(
    (handle: string) => {
      setExtraHandles((curr) => {
        const next = curr.filter((h) => h !== handle);
        persistHandles(next);
        return next;
      });
    },
    [persistHandles]
  );

  // Order rows: own first, then extras in user-set order
  const orderedRows = useMemo(() => {
    const byHandle = new Map(rows.map((r) => [r.handle, r]));
    const ordered: CompareRow[] = [];
    for (const h of ownHandlesList) {
      const r = byHandle.get(h);
      if (r) ordered.push(r);
    }
    for (const h of extraHandles) {
      const r = byHandle.get(h);
      if (r) ordered.push(r);
    }
    return ordered;
  }, [rows, ownHandlesList, extraHandles]);

  const addedSet = useMemo(() => new Set(allHandles), [allHandles]);

  return (
    <>
      <style>{css}</style>

      <header className="cmp-page-head">
        <div>
          <h1 className="cmp-title">Jämför med andra konton</h1>
          <p className="cmp-subtitle">Jämförelsedata uppdateras veckovis.</p>
        </div>
        <div className="cmp-period-pills">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={`cmp-pill${period === p.value ? " cmp-pill--on" : ""}`}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      <div className="cmp-picker-row">
        <button
          type="button"
          className="cmp-add-btn"
          onClick={() => setPickerOpen(true)}
        >
          + Lägg till konto
        </button>
      </div>

      {pickerOpen && (
        <AccountPicker
          addedHandles={addedSet}
          onSelect={addHandle}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {error && <div className="cmp-error">Kunde inte ladda jämförelsen: {error}</div>}

      <div className={`cmp-grid${loading ? " cmp-grid--loading" : ""}`}>
        {orderedRows.length === 0 && !loading ? (
          <p className="cmp-empty">
            Lägg till konton du vill jämföra mot via sökfältet ovan.
          </p>
        ) : (
          orderedRows.map((row) => <CompareCard key={row.handle} row={row} onRemove={removeHandle} />)
        )}
      </div>
    </>
  );
}

function CompareCard({
  row,
  onRemove,
}: {
  row: CompareRow;
  onRemove: (h: string) => void;
}) {
  const b = row.benchmarks;
  return (
    <article className="cmp-card">
      <header className="cmp-card-head">
        {row.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.avatar_url} alt="" className="cmp-card-avatar" />
        ) : (
          <div className="cmp-card-avatar cmp-card-avatar--placeholder" />
        )}
        <div className="cmp-card-identity">
          <div className="cmp-card-name">{row.display_name ?? `@${row.handle}`}</div>
          <div className="cmp-card-handle">@{row.handle}</div>
          <div className="cmp-card-meta">
            {row.followers != null ? `${fmt(row.followers)} följare` : "—"}
            {row.category ? ` · ${row.category}` : ""}
          </div>
        </div>
        {row.is_self ? (
          <span className="cmp-card-badge">Du</span>
        ) : (
          <button
            type="button"
            className="cmp-card-remove"
            aria-label={`Ta bort @${row.handle}`}
            onClick={() => onRemove(row.handle)}
          >
            ×
          </button>
        )}
      </header>

      <div className="cmp-headline">
        <div className="cmp-headline-block">
          <span className="cmp-headline-value">
            {b.avg_er != null ? `${b.avg_er.toFixed(2)}%` : "—"}
          </span>
          <span className="cmp-headline-label">Snitt-engagemang</span>
        </div>
        <div className="cmp-headline-block">
          <span className="cmp-headline-value">{fmtCompact(b.avg_views)}</span>
          <span className="cmp-headline-label">Snitt-visningar</span>
        </div>
      </div>

      <div className="cmp-detail-grid">
        <Cell label="Snitt likes" value={fmtCompact(b.avg_likes)} />
        <Cell label="Snitt komm." value={fmtCompact(b.avg_comments)} />
        <Cell label="Snitt delning" value={fmtCompact(b.avg_shares)} />
        <Cell label="Snitt favoriter" value={fmtCompact(b.avg_collects)} />
      </div>

      <footer className="cmp-card-foot">
        {row.period.video_count} {row.period.video_count === 1 ? "video" : "videor"} ·{" "}
        {b.posts_per_week != null
          ? b.posts_per_week >= 1
            ? `${b.posts_per_week.toFixed(1)}/vecka`
            : `${(b.posts_per_week * 4.33).toFixed(1)}/mån`
          : "—"}
      </footer>
    </article>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="cmp-cell">
      <span className="cmp-cell-value">{value}</span>
      <span className="cmp-cell-label">{label}</span>
    </div>
  );
}

const css = `
  .cmp-page-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
    margin-bottom: 1.25rem;
  }

  .cmp-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 2rem;
    font-weight: 700;
    line-height: 1;
    color: #1C1B19;
  }

  .cmp-subtitle {
    font-size: 12px;
    color: #888;
    margin-top: 4px;
  }

  .cmp-period-pills {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .cmp-pill {
    font-family: 'Barlow', sans-serif;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    padding: 0.4rem 0.9rem;
    background: #fff;
    border: 1.5px solid rgba(28,27,25,0.15);
    border-radius: 999px;
    color: #888;
    cursor: pointer;
    transition: border-color 0.12s, color 0.12s, background 0.12s;
  }

  .cmp-pill:hover {
    border-color: rgba(28,27,25,0.4);
    color: #1C1B19;
  }

  .cmp-pill--on {
    background: #1C1B19;
    border-color: #1C1B19;
    color: #EDF8FB;
  }

  .cmp-picker-row {
    margin-bottom: 1.5rem;
  }

  .cmp-add-btn {
    font-family: 'Barlow', sans-serif;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.04em;
    padding: 0.6rem 1.1rem;
    background: #1C1B19;
    color: #EDF8FB;
    border: 0;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.12s;
  }

  .cmp-add-btn:hover {
    background: #2a2926;
  }

  .cmp-error {
    background: #fff3f3;
    border: 1px solid #f4caca;
    color: #a02020;
    padding: 0.75rem 1rem;
    font-size: 13px;
    border-radius: 4px;
    margin-bottom: 1rem;
  }

  .cmp-empty {
    font-size: 14px;
    color: #888;
    padding: 2.5rem 0;
  }

  .cmp-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
    transition: opacity 0.15s;
  }

  .cmp-grid--loading { opacity: 0.6; }

  .cmp-card {
    background: #fff;
    border: 1px solid rgba(28,27,25,0.1);
    padding: 1.1rem 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    position: relative;
  }

  .cmp-card-head {
    display: flex;
    align-items: flex-start;
    gap: 0.7rem;
  }

  .cmp-card-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    border: 1.5px solid rgba(28,27,25,0.1);
  }

  .cmp-card-avatar--placeholder { background: rgba(28,27,25,0.1); }

  .cmp-card-identity {
    flex: 1;
    min-width: 0;
  }

  .cmp-card-name {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.25rem;
    font-weight: 700;
    line-height: 1.1;
    color: #1C1B19;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cmp-card-handle {
    font-size: 12px;
    color: #888;
    margin-top: 1px;
  }

  .cmp-card-meta {
    font-size: 11px;
    color: #888;
    margin-top: 4px;
  }

  .cmp-card-badge {
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    background: #1C1B19;
    color: #EDF8FB;
    padding: 3px 8px;
    border-radius: 3px;
    align-self: flex-start;
    flex-shrink: 0;
  }

  .cmp-card-remove {
    background: none;
    border: 0;
    cursor: pointer;
    color: #888;
    font-size: 22px;
    line-height: 1;
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    flex-shrink: 0;
    align-self: flex-start;
    transition: background 0.12s, color 0.12s;
  }

  .cmp-card-remove:hover {
    background: rgba(160,32,32,0.08);
    color: #a02020;
  }

  .cmp-headline {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem;
  }

  .cmp-headline-block {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .cmp-headline-value {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.75rem;
    font-weight: 700;
    line-height: 1;
    color: #1C1B19;
  }

  .cmp-headline-label {
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #888;
  }

  .cmp-detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.55rem 0.9rem;
    padding-top: 0.75rem;
    border-top: 1px solid rgba(28,27,25,0.08);
  }

  .cmp-cell {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .cmp-cell-value {
    font-family: 'Barlow', sans-serif;
    font-size: 15px;
    font-weight: 600;
    color: #1C1B19;
  }

  .cmp-cell-label {
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #888;
  }

  .cmp-card-foot {
    font-size: 11px;
    color: #888;
    padding-top: 0.55rem;
    border-top: 1px solid rgba(28,27,25,0.06);
  }
`;
