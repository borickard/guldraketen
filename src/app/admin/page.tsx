"use client";

import { useEffect, useState } from "react";

interface CalcTest {
  id: string;
  handle: string | null;
  video_url: string | null;
  video_id: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  engagement_rate: number | null;
  tested_at: string;
}

interface ContestVideo {
  id: string;
  handle: string;
  video_url: string;
  caption: string | null;
  views: number | null;
  published_at: string | null;
  contest_approved: boolean;
  accounts: { display_name: string | null } | { display_name: string | null }[] | null;
}

interface Account {
  id: string;
  handle: string;
  display_name: string | null;
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
  const [scrapeMsg, setScrapeMsg] = useState("");
  const [daysBack, setDaysBack] = useState(14);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState("");
  const [contestVideos, setContestVideos] = useState<ContestVideo[]>([]);
  const [loadingContests, setLoadingContests] = useState(true);
  const [calcTests, setCalcTests] = useState<CalcTest[]>([]);
  const [calcSort, setCalcSort] = useState("newest");
  const [loadingCalcTests, setLoadingCalcTests] = useState(true);
  const [addingHandle, setAddingHandle] = useState<string | null>(null);
  const [addFeedback, setAddFeedback] = useState<Record<string, string>>({});

  async function fetchAccounts() {
    const res = await fetch("/api/accounts");
    const data = await res.json();
    setAccounts(data);
    setLoading(false);
  }

  async function fetchContestVideos() {
    const res = await fetch("/api/admin/contest-videos");
    const data = await res.json();
    setContestVideos(Array.isArray(data) ? data : []);
    setLoadingContests(false);
  }

  async function fetchCalcTests(sort = "newest") {
    setLoadingCalcTests(true);
    const res = await fetch(`/api/admin/calculator-tests?sort=${sort}`);
    const data = await res.json();
    setCalcTests(Array.isArray(data) ? data : []);
    setLoadingCalcTests(false);
  }

  useEffect(() => { fetchAccounts(); fetchContestVideos(); fetchCalcTests(); }, []);
  useEffect(() => { fetchCalcTests(calcSort); }, [calcSort]);

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

  async function handleDelete(id: string) {
    if (!confirm("Ta bort kontot?")) return;
    await fetch("/api/accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await fetchAccounts();
  }

  async function handleScrape() {
    setScraping(true);
    setScrapeMsg("");
    const res = await fetch("/api/scrape/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ daysBack }),
    });
    const data = await res.json();
    setScrapeMsg(
      res.ok
        ? `Scraping startad – runId: ${data.runId} (${data.handles} konton, ${daysBack} dagar bakåt)`
        : `Fel: ${data.error}`
    );
    setScraping(false);
  }

  async function handleContestToggle(video: ContestVideo) {
    await fetch("/api/admin/contest-videos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: video.id, contest_approved: !video.contest_approved }),
    });
    await fetchContestVideos();
  }

  async function handleBackfill() {
    setBackfilling(true);
    setBackfillMsg("");
    const res = await fetch("/api/admin/backfill-thumbnails", { method: "POST" });
    const data = await res.json();
    setBackfillMsg(
      res.ok
        ? `Uppladdade: ${data.uploaded} · Misslyckades: ${data.failed} · ${data.remaining}`
        : `Fel: ${data.error}`
    );
    setBackfilling(false);
  }

  async function handleAddToTracking(handle: string) {
    if (!handle) return;
    setAddingHandle(handle);
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle }),
    });
    const data = await res.json();
    setAddFeedback((prev) => ({
      ...prev,
      [handle]: res.ok ? "Tillagd!" : data.error ?? "Fel",
    }));
    setAddingHandle(null);
    if (res.ok) await fetchAccounts();
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
          <p className="admin-sub">{active.length} aktiva · {inactive.length} inaktiva</p>
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
                  <input type="checkbox" className="toggle-input" checked={a.is_active} onChange={() => handleToggle(a)} />
                  <span className="toggle-track"><span className="toggle-thumb" /></span>
                </label>
                <div className="account-info">
                  <a className="account-handle" href={`https://www.tiktok.com/@${a.handle}`} target="_blank" rel="noopener noreferrer">
                    @{a.handle}
                  </a>
                  <input
                    className="display-name-input"
                    type="text"
                    placeholder="Visningsnamn (t.ex. Lidl Sverige)"
                    defaultValue={a.display_name ?? ""}
                    onBlur={async (e) => {
                      const val = e.target.value.trim();
                      if (val !== (a.display_name ?? "")) {
                        await fetch("/api/accounts", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: a.id, display_name: val }),
                        });
                        await fetchAccounts();
                      }
                    }}
                  />
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
                <button className="delete-btn" onClick={() => handleDelete(a.id)} aria-label="Ta bort">✕</button>
              </li>
            ))}
          </ul>
        )}

        {/* Scraping */}
        <div className="scrape-section">
          <h2 className="scrape-title">Scraping</h2>
          <div className="scrape-row">
            <div className="days-input-wrap">
              <input
                className="days-input"
                type="number"
                min={1}
                max={90}
                value={daysBack}
                onChange={(e) => setDaysBack(Number(e.target.value))}
              />
              <span className="days-label">dagar bakåt</span>
            </div>
            <button className="scrape-btn" onClick={handleScrape} disabled={scraping}>
              {scraping ? "Startar…" : "Kör scraping nu"}
            </button>
          </div>
          {scrapeMsg && <p className="scrape-msg">{scrapeMsg}</p>}
        </div>

        {/* Backfill thumbnails */}
        <div className="scrape-section">
          <h2 className="scrape-title">Thumbnails</h2>
          <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: "1rem", letterSpacing: "0.02em" }}>
            Laddar upp thumbnails från TikTok CDN till Supabase Storage (50 st per körning). Kör flera gånger tills allt är klart.
          </p>
          <button className="scrape-btn" onClick={handleBackfill} disabled={backfilling}>
            {backfilling ? "Laddar upp…" : "Ladda upp thumbnails"}
          </button>
          {backfillMsg && <p className="scrape-msg">{backfillMsg}</p>}
        </div>

        {/* Contest videos */}
        <div className="scrape-section">
          <h2 className="scrape-title">Tävlingar</h2>
          <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: "1rem", letterSpacing: "0.02em" }}>
            Videor som flaggats som tävlingar baserat på caption-nyckelord. Godkänn en video om den felaktigt flaggats — den tas då med i rankingen.
          </p>
          {loadingContests ? (
            <p className="loading">Laddar…</p>
          ) : contestVideos.length === 0 ? (
            <p className="loading">Inga flaggade videor.</p>
          ) : (
            <ul className="account-list">
              {contestVideos.map((v) => {
                const acct = Array.isArray(v.accounts) ? v.accounts[0] : v.accounts;
                const name = acct?.display_name ?? `@${v.handle}`;
                return (
                  <li key={v.id} className={`account-row ${v.contest_approved ? "" : "account-row--inactive"}`}>
                    <div className="account-info">
                      <a className="account-handle" href={v.video_url} target="_blank" rel="noopener noreferrer">
                        {name}
                      </a>
                      {v.caption && (
                        <span className="account-meta" style={{ fontStyle: "italic" }}>
                          {v.caption.slice(0, 120)}{v.caption.length > 120 ? "…" : ""}
                        </span>
                      )}
                      <span className="account-meta">
                        {v.published_at ? new Date(v.published_at).toLocaleDateString("sv-SE") : ""}
                        {v.views ? ` · ${v.views.toLocaleString("sv-SE")} visningar` : ""}
                      </span>
                    </div>
                    <span className={`status-badge ${v.contest_approved ? "status-badge--active" : ""}`}>
                      {v.contest_approved ? "Godkänd" : "Filtrerad"}
                    </span>
                    <button
                      className="scrape-btn"
                      style={{ fontSize: 10, padding: "0.3rem 0.75rem", boxShadow: "none", flexShrink: 0 }}
                      onClick={() => handleContestToggle(v)}
                    >
                      {v.contest_approved ? "Återflagga" : "Godkänn"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {/* Calculator tests */}
        <div className="scrape-section">
          <h2 className="scrape-title">Kalkylator-tester</h2>
          <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: "1rem", letterSpacing: "0.02em" }}>
            Videor som testats i kalkylatorn. Klicka "Lägg till" för att börja tracka ett konto.
          </p>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            {[
              { key: "newest", label: "Senaste" },
              { key: "oldest", label: "Äldsta" },
              { key: "er", label: "Eng.rate" },
              { key: "handle", label: "Handle" },
            ].map((opt) => (
              <button
                key={opt.key}
                className="scrape-btn"
                style={{
                  fontSize: 9,
                  padding: "0.3rem 0.75rem",
                  boxShadow: calcSort === opt.key ? "none" : "2px 2px 0 var(--border)",
                  opacity: calcSort === opt.key ? 1 : 0.5,
                }}
                onClick={() => setCalcSort(opt.key)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {loadingCalcTests ? (
            <p className="loading">Laddar…</p>
          ) : calcTests.length === 0 ? (
            <p className="loading">Inga tester ännu.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 9 }}>Handle</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 9 }}>Visningar</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 9 }}>Eng.rate</th>
                    <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 9 }}>Testad</th>
                    <th style={{ padding: "6px 8px" }}></th>
                    <th style={{ padding: "6px 8px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {calcTests.map((t) => {
                    const alreadyTracked = accounts.some((a) => a.handle === t.handle);
                    const feedback = t.handle ? addFeedback[t.handle] : undefined;
                    return (
                      <tr key={t.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                        <td style={{ padding: "6px 8px", fontWeight: 600 }}>{t.handle ? `@${t.handle}` : "—"}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", color: "var(--mid)" }}>
                          {t.views != null ? t.views.toLocaleString("sv-SE") : "—"}
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "right", color: "var(--mid)" }}>
                          {t.engagement_rate != null ? `${Number(t.engagement_rate).toFixed(2)}%` : "—"}
                        </td>
                        <td style={{ padding: "6px 8px", color: "var(--muted)" }}>
                          {new Date(t.tested_at).toLocaleDateString("sv-SE")}
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          {t.video_url && (
                            <a href={t.video_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--blue)", fontSize: 10, textDecoration: "underline" }}>
                              Video
                            </a>
                          )}
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          {t.handle && (
                            feedback ? (
                              <span style={{ fontSize: 9, color: feedback === "Tillagd!" ? "green" : "#a33" }}>{feedback}</span>
                            ) : alreadyTracked ? (
                              <span style={{ fontSize: 9, color: "var(--muted)" }}>Trackas</span>
                            ) : (
                              <button
                                className="scrape-btn"
                                style={{ fontSize: 9, padding: "0.2rem 0.6rem", boxShadow: "none" }}
                                disabled={addingHandle === t.handle}
                                onClick={() => handleAddToTracking(t.handle!)}
                              >
                                {addingHandle === t.handle ? "…" : "Lägg till"}
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap');

  :root {
    --bg1:    #ffffff;
    --bg2:    #f7f7f7;
    --blue:   #222222;
    --ink:    #222222;
    --mid:    #555;
    --muted:  #999;
    --border: #222222;
    --border-light: #e0e0e0;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body { background: var(--bg2); }

  .admin-root {
    background: var(--bg2);
    color: var(--ink);
    min-height: 100vh;
    font-family: 'Inter', sans-serif;
    max-width: 640px;
    margin: 0 auto;
    padding: 0 1.5rem 6rem;
  }

  .admin-header {
    padding: 3rem 0 2rem;
    border-bottom: 1px solid var(--border);
    margin-bottom: 1.5rem;
  }

  .admin-eyebrow {
    font-size: 9px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--muted);
    display: block;
    margin-bottom: 0.75rem;
  }

  .admin-title {
    font-family: 'Montserrat', sans-serif;
    font-size: 3rem;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 0.5rem;
    color: var(--ink);
  }

  .admin-sub {
    font-size: 11px;
    color: var(--muted);
    letter-spacing: 0.04em;
  }

  /* Form */
  .add-form { margin-bottom: 2rem; }

  .input-row {
    display: flex;
    align-items: center;
    border: 1px solid var(--border);
    background: var(--bg1);
    overflow: hidden;
    box-shadow: 2px 2px 0 var(--ink);
  }

  .at-sign {
    padding: 0 0.6rem;
    font-size: 13px;
    color: var(--muted);
    flex-shrink: 0;
  }

  .handle-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--ink);
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    padding: 0.65rem 0;
  }

  .handle-input::placeholder { color: var(--muted); }

  .add-btn {
    background: var(--ink);
    border: none;
    border-left: 1px solid var(--border);
    color: var(--bg1);
    font-family: 'Inter', sans-serif;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 0 1.25rem;
    align-self: stretch;
    cursor: pointer;
    transition: background 0.12s;
    white-space: nowrap;
  }

  .add-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .add-btn:not(:disabled):hover { background: #333; }

  .form-error {
    margin-top: 0.5rem;
    font-size: 11px;
    color: #a33;
  }

  /* List */
  .loading, .empty {
    color: var(--muted);
    font-size: 11px;
    padding: 2rem 0;
    letter-spacing: 0.04em;
  }

  .account-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0;
    border: 1px solid var(--border);
    box-shadow: 2px 2px 0 var(--ink);
    background: var(--bg1);
  }

  .account-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 0.85rem;
    border-bottom: 1px solid var(--border-light);
    transition: background 0.12s, opacity 0.15s;
  }

  .account-row:last-child { border-bottom: none; }
  .account-row--inactive { opacity: 0.5; }
  .account-row:hover { background: #faf7f1; opacity: 1; }

  /* Toggle */
  .toggle-label { display: flex; align-items: center; cursor: pointer; flex-shrink: 0; }
  .toggle-input { display: none; }

  .toggle-track {
    width: 32px;
    height: 18px;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 0;
    position: relative;
    transition: background 0.2s;
  }

  .toggle-input:checked + .toggle-track {
    background: var(--blue);
    border-color: var(--blue);
  }

  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 12px;
    height: 12px;
    background: var(--muted);
    transition: transform 0.2s, background 0.2s;
  }

  .toggle-input:checked + .toggle-track .toggle-thumb {
    transform: translateX(14px);
    background: #fff;
  }

  /* Account info */
  .account-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .account-handle {
    font-size: 12px;
    font-weight: 700;
    color: var(--ink);
    text-decoration: none;
    transition: color 0.12s;
  }

  .account-handle:hover { color: var(--blue); }

  .display-name-input {
    background: transparent;
    border: none;
    border-bottom: 1px dashed var(--border-light);
    outline: none;
    font-family: 'Inter', sans-serif;
    font-size: 10px;
    color: var(--mid);
    padding: 1px 2px;
    width: 100%;
    margin-top: 2px;
  }

  .display-name-input::placeholder { color: var(--muted); }
  .display-name-input:focus { border-bottom-color: var(--ink); }

  .account-meta {
    font-size: 10px;
    color: var(--muted);
  }

  .status-badge {
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
    flex-shrink: 0;
  }

  .status-badge--active { color: var(--blue); font-weight: 700; }

  .delete-btn {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    font-size: 11px;
    padding: 0.2rem 0.3rem;
    flex-shrink: 0;
    transition: color 0.12s;
    font-family: 'Inter', sans-serif;
  }

  .delete-btn:hover { color: #a33; }

  /* Scraping section */
  .scrape-section {
    margin-top: 2.5rem;
    border-top: 1px solid var(--border);
    padding-top: 1.5rem;
  }

  .scrape-title {
    font-family: 'Montserrat', sans-serif;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--ink);
    margin-bottom: 1rem;
  }

  .scrape-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .days-input-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid var(--border);
    background: var(--bg1);
    padding: 0.5rem 0.75rem;
    box-shadow: 1px 1px 0 var(--ink);
  }

  .days-input {
    width: 52px;
    background: transparent;
    border: none;
    outline: none;
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    color: var(--ink);
    text-align: center;
  }

  .days-label {
    font-size: 11px;
    color: var(--muted);
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  .scrape-btn {
    background: var(--ink);
    border: 1px solid var(--ink);
    color: var(--bg1);
    font-family: 'Inter', sans-serif;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0.55rem 1.25rem;
    cursor: pointer;
    box-shadow: 2px 2px 0 var(--border);
    transition: background 0.12s;
  }

  .scrape-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .scrape-btn:not(:disabled):hover { background: #333; }

  .scrape-msg {
    margin-top: 0.75rem;
    font-size: 11px;
    color: var(--mid);
    letter-spacing: 0.02em;
  }
`;