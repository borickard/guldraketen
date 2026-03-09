"use client";

import { useEffect, useState } from "react";

interface Account {
    id: string;
    handle: string;
    is_active: boolean;
    followers: number | null;
    followers_updated_at: string | null;
    created_at: string;
}

export default function AdminPage() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState("");
    const [scraping, setScraping] = useState(false);
    const [scrapeResult, setScrapeResult] = useState<string>("");

    async function fetchAccounts() {
        const res = await fetch("/api/accounts");
        const data = await res.json();
        setAccounts(data);
        setLoading(false);
    }

    useEffect(() => { fetchAccounts(); }, []);

    async function handleAdd(e: React.FormEvent) {
        e.preventDefault();
        setAdding(true);
        setError("");

        const res = await fetch("/api/accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ handle: input }),
        });

        if (res.ok) {
            setInput("");
            await fetchAccounts();
        } else {
            const { error } = await res.json();
            setError(error);
        }
        setAdding(false);
    }

    async function handleToggle(account: Account) {
        await fetch("/api/accounts", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: account.id, is_active: !account.is_active }),
        });
        await fetchAccounts();
    }

    async function handleScrape() {
        setScraping(true);
        setScrapeResult("");
        try {
            const res = await fetch("/api/scrape/trigger", {
                method: "POST",
            });

            // Hantera tomt svar (t.ex. vid timeout)
            const text = await res.text();
            const data = text ? JSON.parse(text) : {};

            if (res.ok) {
                setScrapeResult(
                    `✓ Klar – ${data.upserted ?? "?"} videos upsertade, ${data.skipped ?? "?"} hoppades över, ${data.followers ?? "?"} konton uppdaterade.`
                );
            } else {
                setScrapeResult(`✕ Fel: ${data.error ?? res.statusText}`);
            }
        } catch (err) {
            setScrapeResult(`✕ Fel: ${String(err)}`);
        }
        setScraping(false);
        await fetchAccounts();
    }
    
    async function handleDelete(id: string) {
        if (!confirm("Ta bort kontot?")) return;
        await fetch("/api/accounts", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
        });
        await fetchAccounts();
    }

    const active = accounts.filter((a) => a.is_active);
    const inactive = accounts.filter((a) => !a.is_active);

    return (
        <>
            <style>{styles}</style>
            <div className="admin-root">
                <div className="admin-header">
                    <span className="admin-eyebrow">Guldraketen · Admin</span>
                    <h1 className="admin-title">Konton</h1>
                    <p className="admin-sub">
                        {active.length} aktiva · {inactive.length} inaktiva
                    </p>
                </div>

                {/* Scrape trigger */}
                <div className="scrape-section">
                    <button
                        className="scrape-btn"
                        onClick={handleScrape}
                        disabled={scraping}
                    >
                        {scraping ? "Hämtar data…" : "Kör scraping nu"}
                    </button>
                    {scrapeResult && (
                        <p className={`scrape-result ${scrapeResult.startsWith("✓") ? "scrape-result--ok" : "scrape-result--error"}`}>
                            {scrapeResult}
                        </p>
                    )}
                </div>

                {/* Add form */}
                <form className="add-form" onSubmit={handleAdd}>
                    <div className="input-row">
                        <span className="at-sign">@</span>
                        <input
                            className="handle-input"
                            type="text"
                            placeholder="tiktokhandle"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={adding}
                            autoComplete="off"
                            spellCheck={false}
                        />
                        <button className="add-btn" type="submit" disabled={adding || !input.trim()}>
                            {adding ? "Lägger till…" : "Lägg till"}
                        </button>
                    </div>
                    {error && <p className="form-error">{error}</p>}
                </form>

                {/* Account list */}
                {loading ? (
                    <p className="loading">Laddar…</p>
                ) : accounts.length === 0 ? (
                    <p className="empty">Inga konton ännu. Lägg till det första ovan.</p>
                ) : (
                    <ul className="account-list">
                        {accounts.map((a) => (
                            <li key={a.id} className={`account-row ${a.is_active ? "" : "account-row--inactive"}`}>
                                <label className="toggle-label">
                                    <input
                                        type="checkbox"
                                        className="toggle-input"
                                        checked={a.is_active}
                                        onChange={() => handleToggle(a)}
                                    />
                                    <span className="toggle-track">
                                        <span className="toggle-thumb" />
                                    </span>
                                </label>

                                <div className="account-info">
                                    <a
                                        className="account-handle"
                                        href={`https://www.tiktok.com/@${a.handle}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        @{a.handle}
                                    </a>
                                    {a.followers && (
                                        <span className="account-meta">
                                            {a.followers.toLocaleString("sv-SE")} följare
                                            {a.followers_updated_at && (
                                                <> · uppdaterad {new Date(a.followers_updated_at).toLocaleDateString("sv-SE")}</>
                                            )}
                                        </span>
                                    )}
                                </div>

                                <span className={`status-badge ${a.is_active ? "status-badge--active" : ""}`}>
                                    {a.is_active ? "Aktiv" : "Pausad"}
                                </span>

                                <button
                                    className="delete-btn"
                                    onClick={() => handleDelete(a.id)}
                                    aria-label="Ta bort"
                                >
                                    ✕
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </>
    );
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500&display=swap');

  :root {
    --bg:       #0c0b09;
    --bg2:      #141210;
    --bg3:      #1e1b16;
    --gold:     #d4a840;
    --gold-dim: #8a6c28;
    --text:     #e8e2d6;
    --muted:    #7a7060;
    --border:   #2a2520;
    --red:      #c0392b;
    --radius:   6px;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .admin-root {
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    font-family: 'Inter', sans-serif;
    max-width: 640px;
    margin: 0 auto;
    padding: 0 1.5rem 6rem;
  }

  .admin-header {
    padding: 4rem 0 2.5rem;
    border-bottom: 1px solid var(--border);
    margin-bottom: 2rem;
  }

  .admin-eyebrow {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.65rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--gold);
    display: block;
    margin-bottom: 0.75rem;
  }

  .admin-title {
    font-family: 'Playfair Display', serif;
    font-size: 2.75rem;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 0.6rem;
  }

  .admin-sub {
    font-size: 0.85rem;
    color: var(--muted);
    font-family: 'IBM Plex Mono', monospace;
  }

  /* Scrape section */
  .scrape-section {
    margin-bottom: 2rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .scrape-btn {
    background: transparent;
    border: 1px solid var(--gold-dim);
    color: var(--gold);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    padding: 0.7rem 1.25rem;
    border-radius: var(--radius);
    cursor: pointer;
    align-self: flex-start;
    transition: background 0.15s, color 0.15s;
  }

  .scrape-btn:hover:not(:disabled) {
    background: var(--gold-dim);
    color: #0c0b09;
  }

  .scrape-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .scrape-result {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.75rem;
  }

  .scrape-result--ok    { color: #6abf69; }
  .scrape-result--error { color: #e07060; }

  /* Form */
  .add-form { margin-bottom: 2rem; }

  .input-row {
    display: flex;
    align-items: center;
    gap: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg2);
    overflow: hidden;
    transition: border-color 0.15s;
  }

  .input-row:focus-within { border-color: var(--gold-dim); }

  .at-sign {
    padding: 0 0.75rem;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.9rem;
    color: var(--muted);
  }

  .handle-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.9rem;
    padding: 0.75rem 0;
  }

  .handle-input::placeholder { color: var(--muted); }

  .add-btn {
    background: var(--gold);
    border: none;
    color: #0c0b09;
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    font-size: 0.8rem;
    padding: 0 1.25rem;
    height: 100%;
    cursor: pointer;
    transition: opacity 0.15s;
    white-space: nowrap;
    align-self: stretch;
  }

  .add-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .add-btn:not(:disabled):hover { opacity: 0.85; }

  .form-error {
    margin-top: 0.5rem;
    font-size: 0.78rem;
    color: #e07060;
    font-family: 'IBM Plex Mono', monospace;
  }

  /* List */
  .loading, .empty {
    color: var(--muted);
    font-size: 0.85rem;
    padding: 2rem 0;
    font-family: 'IBM Plex Mono', monospace;
  }

  .account-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .account-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.85rem 1rem;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    transition: border-color 0.15s, opacity 0.15s;
  }

  .account-row--inactive { opacity: 0.5; }
  .account-row:hover { border-color: var(--gold-dim); opacity: 1; }

  /* Toggle */
  .toggle-label { display: flex; align-items: center; cursor: pointer; flex-shrink: 0; }
  .toggle-input { display: none; }

  .toggle-track {
    width: 36px;
    height: 20px;
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 999px;
    position: relative;
    transition: background 0.2s, border-color 0.2s;
  }

  .toggle-input:checked + .toggle-track {
    background: var(--gold-dim);
    border-color: var(--gold-dim);
  }

  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    background: var(--muted);
    border-radius: 50%;
    transition: transform 0.2s, background 0.2s;
  }

  .toggle-input:checked + .toggle-track .toggle-thumb {
    transform: translateX(16px);
    background: var(--gold);
  }

  /* Account info */
  .account-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .account-handle {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.88rem;
    font-weight: 500;
    color: var(--text);
    text-decoration: none;
    transition: color 0.12s;
  }

  .account-handle:hover { color: var(--gold); }

  .account-meta {
    font-size: 0.68rem;
    color: var(--muted);
    font-family: 'IBM Plex Mono', monospace;
  }

  /* Status */
  .status-badge {
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-family: 'IBM Plex Mono', monospace;
    color: var(--muted);
    flex-shrink: 0;
  }

  .status-badge--active { color: var(--gold); }

  /* Delete */
  .delete-btn {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    font-size: 0.75rem;
    padding: 0.25rem;
    line-height: 1;
    flex-shrink: 0;
    transition: color 0.12s;
  }

  .delete-btn:hover { color: #e07060; }
`;