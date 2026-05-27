"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
  engagement_rate: number | null;
  is_contest: boolean;
  contest_approved: boolean;
  accounts: AccountJoin | AccountJoin[] | null;
}

const PAGE_SIZE = 100;

function getAcct(v: FeedVideo): AccountJoin | null {
  if (!v.accounts) return null;
  return Array.isArray(v.accounts) ? v.accounts[0] ?? null : v.accounts;
}

function shortDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("sv-SE", { year: "numeric", month: "short", day: "numeric" });
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

  const fetchPage = useCallback(async (nextOffset: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/floden?offset=${nextOffset}&limit=${PAGE_SIZE}`);
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
  }, []);

  useEffect(() => {
    fetchPage(0);
  }, [fetchPage]);

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

  async function toggleContest(v: FeedVideo) {
    if (savingId) return;
    setSavingId(v.id);
    const next = !v.is_contest;
    setVideos((curr) =>
      curr.map((x) =>
        x.id === v.id
          ? { ...x, is_contest: next, contest_approved: next ? x.contest_approved : false }
          : x
      )
    );
    try {
      const res = await fetch("/api/admin/floden", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: v.id, is_contest: next }),
      });
      if (!res.ok) throw new Error("Update failed");
    } catch {
      // revert
      setVideos((curr) =>
        curr.map((x) =>
          x.id === v.id
            ? { ...x, is_contest: v.is_contest, contest_approved: v.contest_approved }
            : x
        )
      );
      alert("Kunde inte uppdatera tävlings-flaggan.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="admin-section flode-section">
      <style>{css}</style>

      <div className="flode-head">
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

      {error && <div className="flode-error">Kunde inte ladda flödet: {error}</div>}

      <div className="flode-grid">
        {filtered.map((v) => {
          const acct = getAcct(v);
          const isSaving = savingId === v.id;
          return (
            <article key={v.id} className={`flode-card${v.is_contest ? " flode-card--contest" : ""}`}>
              <a href={v.video_url} target="_blank" rel="noreferrer" className="flode-thumb-link">
                {v.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumbnail_url} alt="" className="flode-thumb" loading="lazy" />
                ) : (
                  <div className="flode-thumb flode-thumb--empty" />
                )}
                {v.is_contest && <span className="flode-badge">Tävling</span>}
                {v.engagement_rate != null && (
                  <span className="flode-er-chip">
                    {Number(v.engagement_rate).toFixed(2)}%
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
                <button
                  type="button"
                  className={`flode-toggle${v.is_contest ? " flode-toggle--on" : ""}`}
                  disabled={isSaving}
                  onClick={() => toggleContest(v)}
                >
                  {isSaving ? "Sparar…" : v.is_contest ? "Avflagga tävling" : "Flagga som tävling"}
                </button>
              </div>
            </article>
          );
        })}
        {!initialLoad && filtered.length === 0 && (
          <div className="flode-empty">
            {search ? "Inga inlägg matchar sökningen." : "Inga inlägg ännu."}
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
  .flode-section {
    padding-top: 0;
  }

  .flode-head {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.25rem;
    flex-wrap: wrap;
  }

  .flode-search {
    flex: 1;
    min-width: 240px;
    font-family: 'Barlow', sans-serif;
    font-size: 13px;
    padding: 0.55rem 0.85rem;
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
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 1.1rem;
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
    transition: border-color 0.12s, transform 0.12s;
  }

  .flode-card:hover { border-color: rgba(28,27,25,0.25); }

  .flode-card--contest {
    border-color: #C8962A;
    background: #fffaf0;
  }

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

  .flode-thumb--empty {
    background: #f0ece6;
  }

  .flode-badge {
    position: absolute;
    top: 8px;
    left: 8px;
    background: #C8962A;
    color: #fff;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 3px 7px;
    border-radius: 2px;
  }

  .flode-er-chip {
    position: absolute;
    bottom: 8px;
    right: 8px;
    background: rgba(28,27,25,0.85);
    color: #EDF8FB;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.02em;
    padding: 3px 8px;
    border-radius: 3px;
    line-height: 1;
    backdrop-filter: blur(4px);
  }

  .flode-body {
    padding: 0.75rem 0.85rem 0.9rem;
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

  .flode-caption em {
    color: rgba(28,27,25,0.4);
    font-style: italic;
  }

  .flode-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 11px;
    color: rgba(28,27,25,0.55);
  }

  .flode-handle {
    font-weight: 600;
    color: #1C1B19;
  }

  .flode-cat {
    background: rgba(28,27,25,0.06);
    padding: 1px 6px;
    border-radius: 2px;
    font-size: 10px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .flode-date {
    margin-left: auto;
  }

  .flode-toggle {
    font-family: 'Barlow', sans-serif;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    padding: 0.45rem 0.7rem;
    background: #1C1B19;
    color: #EDF8FB;
    border: 0;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.12s, opacity 0.12s;
  }

  .flode-toggle:hover:not(:disabled) { background: #2a2926; }
  .flode-toggle:disabled { opacity: 0.6; cursor: default; }

  .flode-toggle--on {
    background: #fff;
    color: #C8962A;
    border: 1.5px solid #C8962A;
  }

  .flode-toggle--on:hover:not(:disabled) {
    background: #fff5e3;
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
