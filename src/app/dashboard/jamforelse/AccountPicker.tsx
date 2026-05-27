"use client";

import { useEffect, useMemo, useState } from "react";

interface Account {
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  category: string | null;
}

interface Props {
  addedHandles: Set<string>;
  onSelect: (handle: string) => void;
  onClose: () => void;
}

export default function AccountPicker({ addedHandles, onSelect, onClose }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("");

  useEffect(() => {
    fetch("/api/dashboard/accounts-list")
      .then((r) => r.json())
      .then((data: Account[]) => {
        if (Array.isArray(data)) setAccounts(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const a of accounts) {
      if (a.category) set.add(a.category);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "sv"));
  }, [accounts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((a) => {
      if (category && a.category !== category) return false;
      if (q.length === 0) return true;
      const name = (a.display_name ?? "").toLowerCase();
      const handle = a.handle.toLowerCase();
      const cat = (a.category ?? "").toLowerCase();
      return name.includes(q) || handle.includes(q) || cat.includes(q);
    });
  }, [accounts, search, category]);

  return (
    <>
      <style>{css}</style>
      <div className="ap-backdrop" onClick={onClose} role="presentation" />
      <div className="ap-modal" role="dialog" aria-modal="true" aria-label="Lägg till konto">
        <header className="ap-head">
          <h2 className="ap-title">Lägg till konto att jämföra med</h2>
          <button type="button" className="ap-close" onClick={onClose} aria-label="Stäng">
            ×
          </button>
        </header>

        <div className="ap-filters">
          <input
            type="text"
            className="ap-search"
            placeholder="Sök på namn, handle eller kategori…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <select
            className="ap-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Alla kategorier</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="ap-meta">
          {loading
            ? "Laddar…"
            : `${filtered.length} av ${accounts.length} konton`}
        </div>

        <div className="ap-grid">
          {filtered.map((a) => {
            const added = addedHandles.has(a.handle);
            return (
              <button
                key={a.handle}
                type="button"
                className={`ap-card${added ? " ap-card--added" : ""}`}
                disabled={added}
                onClick={() => onSelect(a.handle)}
                title={added ? "Redan tillagd" : `Lägg till @${a.handle}`}
              >
                {a.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.avatar_url} alt="" className="ap-avatar" />
                ) : (
                  <div className="ap-avatar ap-avatar--placeholder">
                    {a.display_name?.[0] ?? a.handle[0]}
                  </div>
                )}
                {added && <span className="ap-badge">Tillagd</span>}
                <div className="ap-name">{a.display_name ?? `@${a.handle}`}</div>
                <div className="ap-handle">@{a.handle}</div>
                {a.category && <div className="ap-cat-tag">{a.category}</div>}
              </button>
            );
          })}
          {!loading && filtered.length === 0 && (
            <div className="ap-empty">Inga matchande konton.</div>
          )}
        </div>
      </div>
    </>
  );
}

const css = `
  .ap-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(28,27,25,0.55);
    z-index: 200;
  }

  .ap-modal {
    position: fixed;
    inset: 5vh 50% auto auto;
    transform: translateX(50%);
    width: min(900px, 92vw);
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    background: #EBE7E2;
    border-radius: 6px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    z-index: 201;
    overflow: hidden;
    font-family: 'Barlow', sans-serif;
    color: #1C1B19;
  }

  .ap-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.1rem 1.4rem;
    border-bottom: 1px solid rgba(28,27,25,0.1);
    background: #fff;
  }

  .ap-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.4rem;
    font-weight: 700;
    line-height: 1;
  }

  .ap-close {
    background: none;
    border: 0;
    cursor: pointer;
    color: #888;
    font-size: 26px;
    line-height: 1;
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background 0.12s, color 0.12s;
  }

  .ap-close:hover {
    background: rgba(28,27,25,0.06);
    color: #1C1B19;
  }

  .ap-filters {
    display: flex;
    gap: 0.5rem;
    padding: 0.9rem 1.4rem;
    background: #fff;
    border-bottom: 1px solid rgba(28,27,25,0.1);
  }

  @media (max-width: 540px) {
    .ap-filters { flex-direction: column; }
  }

  .ap-search,
  .ap-cat {
    font-family: 'Barlow', sans-serif;
    font-size: 13px;
    padding: 0.55rem 0.8rem;
    background: #fff;
    border: 1.5px solid rgba(28,27,25,0.15);
    border-radius: 4px;
    color: #1C1B19;
    outline: none;
    transition: border-color 0.12s;
  }

  .ap-search { flex: 1; }
  .ap-cat { min-width: 200px; }

  .ap-search:focus,
  .ap-cat:focus { border-color: #1C1B19; }

  .ap-meta {
    padding: 0.55rem 1.4rem;
    font-size: 11px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: rgba(28,27,25,0.55);
    background: #fff;
    border-bottom: 1px solid rgba(28,27,25,0.06);
  }

  .ap-grid {
    flex: 1;
    overflow-y: auto;
    padding: 1.1rem 1.4rem 1.4rem;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(125px, 1fr));
    gap: 0.85rem;
  }

  .ap-card {
    position: relative;
    background: #fff;
    border: 1.5px solid rgba(28,27,25,0.1);
    border-radius: 6px;
    padding: 0.9rem 0.5rem 0.7rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    transition: border-color 0.12s, transform 0.12s, background 0.12s;
    font: inherit;
    color: inherit;
    text-align: center;
  }

  .ap-card:hover:not(:disabled) {
    border-color: #1C1B19;
    transform: translateY(-1px);
  }

  .ap-card:disabled {
    cursor: default;
    opacity: 0.45;
  }

  .ap-card--added {
    background: rgba(40,120,60,0.06);
    border-color: rgba(40,120,60,0.3);
    opacity: 0.7;
  }

  .ap-avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    object-fit: cover;
    margin-bottom: 6px;
  }

  .ap-avatar--placeholder {
    background: rgba(28,27,25,0.1);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 24px;
    font-weight: 700;
    color: rgba(28,27,25,0.4);
    text-transform: uppercase;
  }

  .ap-name {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 14px;
    font-weight: 700;
    line-height: 1.1;
    color: #1C1B19;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    max-width: 100%;
  }

  .ap-handle {
    font-size: 10px;
    color: rgba(28,27,25,0.55);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .ap-cat-tag {
    margin-top: 4px;
    font-size: 9px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: rgba(28,27,25,0.5);
    background: rgba(28,27,25,0.06);
    padding: 2px 6px;
    border-radius: 2px;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ap-badge {
    position: absolute;
    top: 6px;
    right: 6px;
    font-size: 9px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    background: rgba(40,120,60,0.18);
    color: #2d6034;
    padding: 2px 5px;
    border-radius: 2px;
  }

  .ap-empty {
    grid-column: 1 / -1;
    padding: 2rem;
    font-size: 13px;
    color: rgba(28,27,25,0.55);
    text-align: center;
  }
`;
