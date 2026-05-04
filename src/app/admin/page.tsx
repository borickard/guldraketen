"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  username: string;
  is_active: boolean;
  created_at: string;
  notes: string | null;
  handles: string[];
}

const USD_TO_SEK = 10.5; // approximate, update as needed
const COST_USD_PER_RESULT = 4 / 1000;

function costSEK(results: number): string {
  const sek = results * COST_USD_PER_RESULT * USD_TO_SEK;
  return sek.toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " kr";
}

function toWeekLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - new Date(Date.UTC(year, 0, 1)).getTime()) / 86400000 + 1) / 7);
  return `V${week} ${year}`;
}

const CATEGORIES = [
  "Mat & dryck",
  "Handel & e-handel",
  "Mode & skönhet",
  "Hälsa & välmående",
  "Media & underhållning",
  "Bank & finans",
  "Teknik & IT",
  "Sport & fritid",
  "Resor & upplevelser",
  "Utbildning",
  "Fordon",
  "Offentlig sektor & ideellt",
  "Politik & intresseorganisationer",
];


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
  source: "db" | "apify" | null;
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

interface ScrapeRun {
  id: string;
  run_id: string | null;
  triggered_by: string;
  days_back: number | null;
  handles: number | null;
  status: "started" | "completed" | "failed";
  error: string | null;
  upserted: number | null;
  skipped: number | null;
  followers: number | null;
  started_at: string;
  completed_at: string | null;
}

interface Account {
  id: string;
  handle: string;
  display_name: string | null;
  category: string | null;
  is_active: boolean;
  followers: number | null;
  followers_updated_at: string | null;
  created_at: string;
  videos: [{ count: number }] | null;
}

const VALID_TABS = ["konton", "tavlingar", "kalkylator", "scrape-log", "users", "feedback", "betatest"] as const;
type TabKey = typeof VALID_TABS[number];

export default function AdminPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [showVerktyg, setShowVerktyg] = useState(false);

  const [scraping, setScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState("");
  const [daysBack, setDaysBack] = useState(14);
  const [rescrapeHandle, setRescrapeHandle] = useState("");
  const [rescrapePosts, setRescrapePosts] = useState(50);
  const [rescrapingHandle, setRescrapingHandle] = useState(false);
  const [rescrapeMsg, setRescrapeMsg] = useState("");

  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState("");
  const [backfillingAvatars, setBackfillingAvatars] = useState(false);
  const [backfillAvatarsMsg, setBackfillAvatarsMsg] = useState("");
  const [contestVideos, setContestVideos] = useState<ContestVideo[]>([]);
  const [loadingContests, setLoadingContests] = useState(true);
  const [calcTests, setCalcTests] = useState<CalcTest[]>([]);
  const [calcSort, setCalcSort] = useState("newest");
  const [loadingCalcTests, setLoadingCalcTests] = useState(true);
  const [addingHandle, setAddingHandle] = useState<string | null>(null);
  const [addFeedback, setAddFeedback] = useState<Record<string, string>>({});

  const [calcDailyLimit, setCalcDailyLimit] = useState<number>(100);
  const [calcLimitInput, setCalcLimitInput] = useState<string>("100");
  const [calcUsage, setCalcUsage] = useState<{ today: number; week: number; month: number } | null>(null);
  const [savingLimit, setSavingLimit] = useState(false);
  const [limitSaved, setLimitSaved] = useState(false);

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

  async function fetchCalcSettings() {
    const res = await fetch("/api/admin/settings");
    const data = await res.json();
    const limit = parseInt(data.calc_daily_limit ?? "100", 10) || 100;
    setCalcDailyLimit(limit);
    setCalcLimitInput(String(limit));
  }

  async function fetchCalcUsage() {
    const res = await fetch("/api/admin/calc-usage");
    const data = await res.json();
    setCalcUsage(data);
  }

  async function handleSaveLimit() {
    const val = parseInt(calcLimitInput, 10);
    if (isNaN(val) || val < 1) return;
    setSavingLimit(true);
    await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "calc_daily_limit", value: String(val) }),
    });
    setCalcDailyLimit(val);
    setSavingLimit(false);
    setLimitSaved(true);
    setTimeout(() => setLimitSaved(false), 2000);
  }

  useEffect(() => {
    setAuthed(localStorage.getItem("adminAuth") === "ok");
    // Read initial tab from URL
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && (VALID_TABS as readonly string[]).includes(t)) {
      setActiveSection(t as TabKey);
    }
  }, []);

  useEffect(() => {
    if (authed) { fetchAccounts(); fetchContestVideos(); fetchCalcTests(); fetchUsers(); fetchFeedback(); fetchBetaSignups(); fetchCalcSettings(); fetchCalcUsage(); }
  }, [authed]); // eslint-disable-line

  useEffect(() => {
    if (authed) fetchCalcTests(calcSort);
  }, [calcSort]); // eslint-disable-line

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pwInput }),
    });
    if (res.ok) {
      localStorage.setItem("adminAuth", "ok");
      setAuthed(true);
      setPwError(false);
    } else {
      setPwError(true);
      setPwInput("");
    }
  }

  function handleLogout() {
    localStorage.removeItem("adminAuth");
    setAuthed(false);
  }

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

  async function handleCategoryChange(account: Account, newCategory: string) {
    await fetch("/api/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: account.id, category: newCategory || null }),
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

  async function handleRescrapeAccount() {
    if (!rescrapeHandle) return;
    setRescrapingHandle(true);
    setRescrapeMsg("Hämtar från Apify…");
    const res = await fetch("/api/admin/rescrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: rescrapeHandle, postsBack: rescrapePosts }),
    });
    const data = await res.json();
    setRescrapeMsg(
      res.ok
        ? `Klar — ${data.upserted ?? 0} videor sparade, ${data.skipped ?? 0} hoppade över (runId: ${data.runId})`
        : `Fel: ${data.error}`
    );
    setRescrapingHandle(false);
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

  async function handleBackfillAvatars() {
    setBackfillingAvatars(true);
    setBackfillAvatarsMsg("Kör Apify — kan ta upp till 2 min…");
    const res = await fetch("/api/admin/backfill-avatars", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      const debugLines = Object.entries(data.debug as Record<string, string>)
        .map(([h, s]) => `${h}: ${s}`)
        .join(" · ");
      setBackfillAvatarsMsg(
        `Konton: ${data.handles} · Items: ${data.items_returned} · Avatarer hittade: ${data.avatars_found} · Sparade: ${data.saved} · Fel: ${data.failed}${debugLines ? ` — ${debugLines}` : ""}`
      );
    } else {
      setBackfillAvatarsMsg(`Fel: ${data.error}`);
    }
    setBackfillingAvatars(false);
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

  const [activeSection, setActiveSection] = useState<TabKey>("konton");
  const [scrapeRuns, setScrapeRuns] = useState<ScrapeRun[]>([]);
  const [loadingScrapeRuns, setLoadingScrapeRuns] = useState(false);

  interface FeedbackItem { id: string; email: string | null; message: string; page: string | null; created_at: string; }
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  async function fetchFeedback() {
    setLoadingFeedback(true);
    const res = await fetch("/api/admin/feedback");
    const data = await res.json();
    setFeedbackItems(Array.isArray(data) ? data : []);
    setLoadingFeedback(false);
  }

  interface BetaSignup { id: string; email: string; handle: string | null; video_url: string | null; created_at: string; }
  const [betaSignups, setBetaSignups] = useState<BetaSignup[]>([]);
  const [loadingBetaSignups, setLoadingBetaSignups] = useState(false);

  async function fetchBetaSignups() {
    setLoadingBetaSignups(true);
    const res = await fetch("/api/admin/beta-signups");
    const data = await res.json();
    setBetaSignups(Array.isArray(data) ? data : []);
    setLoadingBetaSignups(false);
  }

  async function fetchScrapeRuns() {
    setLoadingScrapeRuns(true);
    const res = await fetch("/api/admin/scrape-runs");
    const data = await res.json();
    setScrapeRuns(Array.isArray(data) ? data : []);
    setLoadingScrapeRuns(false);
  }

  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [addUserError, setAddUserError] = useState("");
  const [addingUser, setAddingUser] = useState(false);
  const [pwChangeId, setPwChangeId] = useState<string | null>(null);
  const [pwChangeValue, setPwChangeValue] = useState("");

  // New-handle-for-user form
  const [newHandleUserId, setNewHandleUserId] = useState<string | null>(null);
  const [newHandleInput, setNewHandleInput] = useState("");
  const [newHandlePosts, setNewHandlePosts] = useState(50);
  const [newHandleLoading, setNewHandleLoading] = useState(false);
  const [newHandleResult, setNewHandleResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleAddNewHandle(userId: string) {
    const h = newHandleInput.trim().replace(/^@/, "");
    if (!h) return;
    setNewHandleLoading(true);
    setNewHandleResult(null);
    const res = await fetch("/api/admin/add-handle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, handle: h, postsBack: newHandlePosts }),
    });
    const data = await res.json();
    if (data.ok) {
      const msg = data.scrapeError
        ? `@${h} tillagt — scraping misslyckades: ${data.scrapeError}`
        : `@${h} tillagt och scraping startad (${newHandlePosts} inlägg)`;
      setNewHandleResult({ ok: true, msg });
      setNewHandleInput("");
      await fetchUsers();
      setTimeout(() => { setNewHandleUserId(null); setNewHandleResult(null); }, 4000);
    } else {
      setNewHandleResult({ ok: false, msg: data.error ?? "Okänt fel" });
    }
    setNewHandleLoading(false);
  }

  async function fetchUsers() {
    setLoadingUsers(true);
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(Array.isArray(data) ? data : []);
    setLoadingUsers(false);
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setAddingUser(true);
    setAddUserError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: newUsername, password: newPassword }),
    });
    const data = await res.json();
    if (res.ok) {
      setNewUsername("");
      setNewPassword("");
      await fetchUsers();
    } else {
      setAddUserError(data.error ?? "Fel");
    }
    setAddingUser(false);
  }

  async function handleDeleteUser(id: string) {
    if (!confirm("Ta bort användaren?")) return;
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await fetchUsers();
  }

  async function handleToggleUser(user: User) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, is_active: !user.is_active }),
    });
    await fetchUsers();
  }

  async function handleChangePassword(id: string) {
    if (!pwChangeValue.trim()) return;
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, password: pwChangeValue }),
    });
    setPwChangeId(null);
    setPwChangeValue("");
  }

  async function handleAddHandleToUser(userId: string, handle: string) {
    await fetch("/api/admin/users/handles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, handle }),
    });
    await fetchUsers();
  }

  async function handleRemoveHandleFromUser(userId: string, handle: string) {
    await fetch("/api/admin/users/handles", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, handle }),
    });
    await fetchUsers();
  }

  const active = accounts.filter((a) => a.is_active);
  const inactive = accounts.filter((a) => !a.is_active);
  const videoCount = (a: Account) => a.videos?.[0]?.count ?? 0;
  const totalVideos = accounts.reduce((sum, a) => sum + videoCount(a), 0);

  if (authed === null) return null;

  if (!authed) return (
    <>
      <style>{styles}</style>
      <div className="login-root">
        <form className="login-form" onSubmit={handleLogin}>
          <span className="admin-eyebrow">Sociala Raketer · Admin</span>
          <h1 className="admin-title" style={{ margin: "0.75rem 0 1.5rem" }}>Logga in</h1>
          <input
            className="handle-input"
            style={{ border: "1px solid var(--border)", padding: "0.65rem 0.85rem", width: "100%", marginBottom: "0.75rem", background: "var(--bg1)", fontSize: 13 }}
            type="password"
            placeholder="Lösenord"
            value={pwInput}
            onChange={(e) => { setPwInput(e.target.value); setPwError(false); }}
            autoFocus
          />
          {pwError && <p className="form-error">Fel lösenord. Försök igen.</p>}
          <button className="add-btn" type="submit" style={{ padding: "0.7rem", alignSelf: "auto" }}>
            Logga in
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      <style>{styles}</style>
      <div className="admin-root">
        <div className="admin-header">
          <div>
            <span className="admin-eyebrow">Sociala Raketer · Admin</span>
            <h1 className="admin-title">Admin</h1>
          </div>
          <button className="logout-btn" onClick={handleLogout}>Logga ut</button>
        </div>

        <div className="admin-tabs">
          {([
            { key: "konton", label: "Konton", meta: `${active.length} aktiva` },
            { key: "tavlingar", label: "Tävlingar", meta: `${contestVideos.filter(v => !v.contest_approved).length} att granska` },
            { key: "kalkylator", label: "Kalkylator", meta: `${calcTests.length} tester` },
            { key: "scrape-log", label: "Scrape-log", meta: "" },
            { key: "users", label: "Användare", meta: `${users.length}` },
            { key: "feedback", label: "Feedback", meta: feedbackItems.length > 0 ? `${feedbackItems.length}` : "" },
            { key: "betatest", label: "Betatest", meta: betaSignups.length > 0 ? `${betaSignups.length}` : "" },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              className={`admin-tab${activeSection === tab.key ? " admin-tab--active" : ""}`}
              onClick={() => {
                setActiveSection(tab.key);
                router.replace(`?tab=${tab.key}`, { scroll: false });
                if (tab.key === "scrape-log") fetchScrapeRuns();
                if (tab.key === "users") fetchUsers();
                if (tab.key === "feedback") fetchFeedback();
                if (tab.key === "betatest") fetchBetaSignups();
                if (tab.key === "kalkylator") { fetchCalcSettings(); fetchCalcUsage(); }
              }}
            >
              {tab.label}
              <span className="admin-tab-meta">{tab.meta}</span>
            </button>
          ))}
        </div>

        {/* ── Section 1: Spårade konton ── */}
        {activeSection === "konton" && <div className="admin-section">
          <div className="admin-section-hdr">
            <h2 className="admin-section-title">Spårade konton</h2>
            <span className="admin-section-meta">{active.length} aktiva · {inactive.length} inaktiva · {totalVideos.toLocaleString("sv-SE")} videor totalt</span>
          </div>

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

          {loading ? (
            <p className="loading">Laddar…</p>
          ) : accounts.length === 0 ? (
            <p className="empty">Inga konton ännu. Lägg till det första ovan.</p>
          ) : (
            <>
              {active.length > 0 && (
                <ul className="account-list">
                  {active.map((a) => <AccountRow key={a.id} a={a} onToggle={handleToggle} onDelete={handleDelete} onCategoryChange={handleCategoryChange} onRename={fetchAccounts} />)}
                </ul>
              )}
              {inactive.length > 0 && (
                <>
                  <p className="accounts-divider">Inaktiva ({inactive.length})</p>
                  <ul className="account-list">
                    {inactive.map((a) => <AccountRow key={a.id} a={a} onToggle={handleToggle} onDelete={handleDelete} onCategoryChange={handleCategoryChange} onRename={fetchAccounts} />)}
                  </ul>
                </>
              )}
            </>
          )}

          <div className="admin-tools">
            <div className="admin-tool">
              <p className="admin-tool-label">Scraping</p>
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

            <div className="admin-tool" style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
              <p className="admin-tool-label">Scrapa enskilt konto</p>
              <p className="admin-tool-desc">Välj ett befintligt konto och hämta de senaste X inläggen.</p>
              <div className="scrape-row">
                <select
                  className="handle-input"
                  style={{ flex: 2, height: 36 }}
                  value={rescrapeHandle}
                  onChange={(e) => setRescrapeHandle(e.target.value)}
                >
                  <option value="">Välj konto…</option>
                  {accounts.map((a) => (
                    <option key={a.handle} value={a.handle}>
                      {a.display_name ? `${a.display_name} (@${a.handle})` : `@${a.handle}`}
                    </option>
                  ))}
                </select>
                <div className="days-input-wrap">
                  <input
                    className="days-input"
                    type="number"
                    min={1}
                    max={200}
                    value={rescrapePosts}
                    onChange={(e) => setRescrapePosts(Number(e.target.value))}
                  />
                  <span className="days-label">inlägg</span>
                </div>
                <button
                  className="scrape-btn"
                  onClick={handleRescrapeAccount}
                  disabled={rescrapingHandle || !rescrapeHandle}
                >
                  {rescrapingHandle ? "Hämtar…" : "Kör"}
                </button>
              </div>
              {rescrapeMsg && <p className="scrape-msg">{rescrapeMsg}</p>}
            </div>
          </div>

          <div className="verktyg-section">
            <button className="verktyg-toggle" onClick={() => setShowVerktyg(!showVerktyg)}>
              <span>Underhållsverktyg</span>
              <span style={{ display: "inline-block", transition: "transform 0.2s", transform: showVerktyg ? "rotate(180deg)" : "none" }}>▾</span>
            </button>
            {showVerktyg && (
              <div className="admin-tools" style={{ marginTop: "1rem" }}>
                <div className="admin-tool">
                  <p className="admin-tool-label">Thumbnails (backfill)</p>
                  <p className="admin-tool-desc">Laddar upp thumbnails från TikTok CDN till Supabase Storage (50 st per körning). Behövs normalt inte — sker automatiskt vid scraping.</p>
                  <button className="scrape-btn" onClick={handleBackfill} disabled={backfilling}>
                    {backfilling ? "Laddar upp…" : "Ladda upp thumbnails"}
                  </button>
                  {backfillMsg && <p className="scrape-msg">{backfillMsg}</p>}
                </div>
                <div className="admin-tool">
                  <p className="admin-tool-label">Avatarer (backfill)</p>
                  <p className="admin-tool-desc">Hämtar profilavatarer för alla aktiva konton via Apify och sparar till Supabase Storage. Behövs normalt inte — sker automatiskt vid scraping.</p>
                  <button className="scrape-btn" onClick={handleBackfillAvatars} disabled={backfillingAvatars}>
                    {backfillingAvatars ? "Hämtar…" : "Hämta avatarer"}
                  </button>
                  {backfillAvatarsMsg && <p className="scrape-msg">{backfillAvatarsMsg}</p>}
                </div>
              </div>
            )}
          </div>
        </div>

        }

        {/* ── Section 2: Tävlingsvideor ── */}
        {activeSection === "tavlingar" && (() => {
          const pending  = contestVideos.filter(v => !v.contest_approved);
          const approved = contestVideos.filter(v =>  v.contest_approved);

          function ContestRow({ v }: { v: ContestVideo }) {
            const acct = Array.isArray(v.accounts) ? v.accounts[0] : v.accounts;
            const name = acct?.display_name ?? `@${v.handle}`;
            const weekLabel = v.published_at ? toWeekLabel(v.published_at) : null;
            return (
              <li key={v.id} className="account-row">
                <div className="account-info">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <a className="account-handle" href={v.video_url} target="_blank" rel="noopener noreferrer">
                      {name}
                    </a>
                    {weekLabel && <span className="week-badge">{weekLabel}</span>}
                  </div>
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
                <span className={`status-badge ${v.contest_approved ? "status-badge--included" : "status-badge--excluded"}`}>
                  {v.contest_approved ? "Inkluderad" : "Utesluten"}
                </span>
                <button
                  className="scrape-btn"
                  style={{ fontSize: 10, padding: "0.3rem 0.75rem", boxShadow: "none", flexShrink: 0 }}
                  onClick={() => handleContestToggle(v)}
                >
                  {v.contest_approved ? "Återflagga" : "Godkänn för rankning"}
                </button>
              </li>
            );
          }

          return (
            <div className="admin-section">
              <div className="admin-section-hdr">
                <h2 className="admin-section-title">Tävlingsvideor</h2>
                <span className="admin-section-meta">Flaggade via caption-nyckelord</span>
              </div>
              <p className="admin-section-desc">
                Videor auto-flaggade som tävlingsinlägg utesluts ur rankingen. Godkänn en video om den är felaktigt flaggad.
              </p>

              {loadingContests ? (
                <p className="loading">Laddar…</p>
              ) : (
                <>
                  {/* Group 1: Needs review */}
                  <p className="contest-group-label">
                    Att granska
                    <span className="contest-group-count">{pending.length}</span>
                  </p>
                  {pending.length === 0 ? (
                    <p className="loading" style={{ paddingTop: "0.75rem" }}>Inga videor att granska.</p>
                  ) : (
                    <ul className="account-list" style={{ marginBottom: "2rem" }}>
                      {pending.map(v => <ContestRow key={v.id} v={v} />)}
                    </ul>
                  )}

                  {/* Group 2: Approved for ranking */}
                  {approved.length > 0 && (
                    <>
                      <p className="contest-group-label" style={{ marginTop: "1.5rem" }}>
                        Godkända för rankning
                        <span className="contest-group-count">{approved.length}</span>
                      </p>
                      <ul className="account-list">
                        {approved.map(v => <ContestRow key={v.id} v={v} />)}
                      </ul>
                    </>
                  )}
                </>
              )}
            </div>
          );
        })()}

        {/* ── Section 3: Kalkylator-tester ── */}
        {activeSection === "kalkylator" && <div className="admin-section">
          <div className="admin-section-hdr">
            <h2 className="admin-section-title">Kalkylator-tester</h2>
            <span className="admin-section-meta">{calcTests.length} videor</span>
          </div>

          {/* Limit + usage panel */}
          <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", boxShadow: "2px 2px 0 var(--border)", padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
            <p className="admin-tool-label" style={{ marginBottom: "0.75rem" }}>Daglig Apify-gräns</p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: calcUsage ? "1rem" : 0 }}>
              <div className="days-input-wrap">
                <input
                  className="days-input"
                  type="number"
                  min={1}
                  max={500}
                  value={calcLimitInput}
                  onChange={(e) => setCalcLimitInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveLimit()}
                />
                <span className="days-label">per dag</span>
              </div>
              <button className="scrape-btn" onClick={handleSaveLimit} disabled={savingLimit}>
                {limitSaved ? "Sparad!" : savingLimit ? "Sparar…" : "Spara"}
              </button>
              <span style={{ fontSize: 10, color: "var(--muted)" }}>
                Cachat innehåll räknas inte mot gränsen.
              </span>
            </div>
            {calcUsage && (
              <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", borderTop: "1px solid var(--border-light)", paddingTop: "0.75rem" }}>
                <div>
                  <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", display: "block", marginBottom: 3 }}>Idag</span>
                  <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: calcUsage.today >= calcDailyLimit ? "#b30000" : "var(--ink)" }}>
                    {calcUsage.today}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 4 }}>/ {calcDailyLimit}</span>
                </div>
                <div>
                  <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", display: "block", marginBottom: 3 }}>Denna vecka</span>
                  <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: "var(--ink)" }}>{calcUsage.week}</span>
                </div>
                <div>
                  <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", display: "block", marginBottom: 3 }}>Denna månad</span>
                  <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: "var(--ink)" }}>{calcUsage.month}</span>
                </div>
              </div>
            )}
          </div>

          <p className="admin-section-desc">
            Videor som testats via kalkylatorn. Klicka "Lägg till" för att börja tracka ett konto.
            {calcTests.length > 0 && (() => {
              const apifyCount = calcTests.filter(t => t.source === "apify").length;
              return apifyCount > 0 ? (
                <span style={{ marginLeft: 8, color: "var(--mid)" }}>
                  Total kostnad (Apify): <strong>{costSEK(apifyCount)}</strong>
                </span>
              ) : null;
            })()}
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
                    <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 9 }}>Källa</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 9 }}>Kostnad</th>
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
                          {t.source === "db" ? (
                            <span style={{ fontSize: 9, background: "#e8f4e8", color: "#2a7a2a", padding: "2px 6px", borderRadius: 3, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>DB</span>
                          ) : t.source === "apify" ? (
                            <span style={{ fontSize: 9, background: "#f0f0f0", color: "#666", padding: "2px 6px", borderRadius: 3, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Apify</span>
                          ) : (
                            <span style={{ fontSize: 9, color: "var(--muted)" }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "right", color: "var(--mid)" }}>
                          {t.source === "apify" ? costSEK(1) : <span style={{ color: "var(--muted)" }}>—</span>}
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
        }

        {/* ── Section 4: Scrape-log ── */}
        {activeSection === "scrape-log" && <div className="admin-section">
          <div className="admin-section-hdr" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 className="admin-section-title">Scrape-log</h2>
            <button className="add-btn" onClick={fetchScrapeRuns} disabled={loadingScrapeRuns}>
              {loadingScrapeRuns ? "Laddar…" : "Uppdatera"}
            </button>
          </div>

          {loadingScrapeRuns ? (
            <p className="loading">Laddar…</p>
          ) : scrapeRuns.length === 0 ? (
            <p className="empty">Inga körningar loggade ännu.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="calc-table" style={{ fontSize: 11 }}>
                <thead>
                  <tr>
                    <th>Tid</th>
                    <th>Källa</th>
                    <th>Status</th>
                    <th className="right">Konton</th>
                    <th className="right">Dagar</th>
                    <th className="right">Upsertade</th>
                    <th className="right">Hoppade</th>
                    <th className="right">Varaktighet</th>
                    <th className="right">Kostnad</th>
                  </tr>
                </thead>
                <tbody>
                  {scrapeRuns.map((r) => {
                    const duration = r.completed_at
                      ? Math.round((new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()) / 1000)
                      : null;
                    const statusColor = r.status === "completed" ? "#2a7a2a" : r.status === "failed" ? "#b30000" : "#a06000";
                    return (
                      <tr key={r.id}>
                        <td style={{ whiteSpace: "nowrap" }}>{new Date(r.started_at).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}</td>
                        <td>{r.triggered_by}</td>
                        <td style={{ color: statusColor, fontWeight: 600 }}>
                          {r.status}
                          {r.status === "failed" && r.error && (
                            <span title={r.error} style={{ cursor: "help", marginLeft: 4 }}>⚠</span>
                          )}
                        </td>
                        <td className="right">{r.handles ?? "—"}</td>
                        <td className="right">{r.days_back ?? "—"}</td>
                        <td className="right">{r.upserted ?? "—"}</td>
                        <td className="right">{r.skipped ?? "—"}</td>
                        <td className="right">{duration !== null ? `${duration}s` : "—"}</td>
                        <td className="right" style={{ color: "var(--mid)" }}>
                          {(r.upserted != null || r.skipped != null)
                            ? costSEK((r.upserted ?? 0) + (r.skipped ?? 0))
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        }

        {/* ── Section 5: Användare ── */}
        {activeSection === "users" && (
          <div className="admin-section">
            <div className="admin-section-hdr">
              <h2 className="admin-section-title">Användare</h2>
              <span className="admin-section-meta">{users.length} användare</span>
            </div>
            <p className="admin-section-desc">
              Skapa inloggningar för dashboard-åtkomst. Varje användare kopplas till ett eller flera spårade konton.
            </p>

            <form className="add-form" onSubmit={handleAddUser} style={{ marginBottom: "1.5rem" }}>
              <div className="input-row">
                <input
                  className="handle-input"
                  type="text"
                  placeholder="användarnamn"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  disabled={addingUser}
                  autoComplete="off"
                  spellCheck={false}
                />
                <input
                  className="handle-input"
                  type="password"
                  placeholder="lösenord"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={addingUser}
                  style={{ borderLeft: "1px solid var(--border-light)" }}
                />
                <button className="add-btn" type="submit" disabled={addingUser || !newUsername.trim() || !newPassword.trim()}>
                  {addingUser ? "Skapar…" : "Skapa"}
                </button>
              </div>
              {addUserError && <p className="form-error">{addUserError}</p>}
            </form>

            {loadingUsers ? (
              <p className="loading">Laddar…</p>
            ) : users.length === 0 ? (
              <p className="empty">Inga användare ännu.</p>
            ) : (
              <ul className="account-list">
                {users.map((u) => {
                  const availableHandles = accounts
                    .filter((a) => a.is_active && !u.handles.includes(a.handle))
                    .map((a) => a.handle);
                  return (
                    <li key={u.id} className={`account-row${u.is_active ? "" : " account-row--inactive"}`} style={{ flexDirection: "column", alignItems: "flex-start", gap: "0.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", width: "100%" }}>
                        <label className="toggle-label">
                          <input type="checkbox" className="toggle-input" checked={u.is_active} onChange={() => handleToggleUser(u)} />
                          <span className="toggle-track"><span className="toggle-thumb" /></span>
                        </label>
                        <span className="account-handle" style={{ flex: 1 }}>{u.username}</span>
                        <span className="account-meta">{new Date(u.created_at).toLocaleDateString("sv-SE")}</span>
                        <button
                          className="scrape-btn"
                          style={{ fontSize: 9, padding: "0.25rem 0.6rem", boxShadow: "none" }}
                          onClick={() => { setPwChangeId(pwChangeId === u.id ? null : u.id); setPwChangeValue(""); }}
                        >
                          Byt lösenord
                        </button>
                        <button className="delete-btn" onClick={() => handleDeleteUser(u.id)} aria-label="Ta bort">✕</button>
                      </div>

                      {pwChangeId === u.id && (
                        <div style={{ display: "flex", gap: "0.5rem", paddingLeft: "2.5rem" }}>
                          <input
                            className="handle-input"
                            type="password"
                            placeholder="Nytt lösenord"
                            value={pwChangeValue}
                            onChange={(e) => setPwChangeValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleChangePassword(u.id)}
                            style={{ border: "1px solid var(--border)", padding: "0.4rem 0.6rem", fontSize: 12, width: 200 }}
                            autoFocus
                          />
                          <button
                            className="scrape-btn"
                            style={{ fontSize: 9, padding: "0.25rem 0.75rem", boxShadow: "none" }}
                            onClick={() => handleChangePassword(u.id)}
                            disabled={!pwChangeValue.trim()}
                          >
                            Spara
                          </button>
                        </div>
                      )}

                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", paddingLeft: "2.5rem", alignItems: "center" }}>
                        {u.handles.map((h) => (
                          <span key={h} className="handle-chip">
                            @{h}
                            <button onClick={() => handleRemoveHandleFromUser(u.id, h)} aria-label="Ta bort handle">×</button>
                          </span>
                        ))}
                        {availableHandles.length > 0 && (
                          <select
                            className="category-select"
                            value=""
                            onChange={(e) => { if (e.target.value) handleAddHandleToUser(u.id, e.target.value); }}
                          >
                            <option value="">+ Befintligt konto</option>
                            {availableHandles.map((h) => (
                              <option key={h} value={h}>@{h}</option>
                            ))}
                          </select>
                        )}
                        <button
                          className="scrape-btn"
                          style={{ fontSize: 10, padding: "0.25rem 0.65rem", boxShadow: "none" }}
                          onClick={() => {
                            const opening = newHandleUserId !== u.id;
                            setNewHandleUserId(opening ? u.id : null);
                            setNewHandleInput("");
                            setNewHandleResult(null);
                          }}
                        >
                          {newHandleUserId === u.id ? "Avbryt" : "+ Nytt konto"}
                        </button>
                      </div>

                      {/* ── Inline new-handle + scrape form ── */}
                      {newHandleUserId === u.id && (
                        <div style={{ paddingLeft: "2.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                            <input
                              className="handle-input"
                              type="text"
                              placeholder="@handle"
                              value={newHandleInput}
                              onChange={(e) => setNewHandleInput(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && !newHandleLoading && handleAddNewHandle(u.id)}
                              disabled={newHandleLoading}
                              autoFocus
                              style={{ width: 160 }}
                            />
                            <select
                              className="category-select"
                              value={newHandlePosts}
                              onChange={(e) => setNewHandlePosts(Number(e.target.value))}
                              disabled={newHandleLoading}
                              title="Antal inlägg att hämta"
                            >
                              <option value={20}>20 inlägg</option>
                              <option value={50}>50 inlägg</option>
                              <option value={100}>100 inlägg</option>
                              <option value={200}>200 inlägg</option>
                            </select>
                            <button
                              className="add-btn"
                              onClick={() => handleAddNewHandle(u.id)}
                              disabled={newHandleLoading || !newHandleInput.trim()}
                            >
                              {newHandleLoading ? "Skapar…" : "Lägg till & scrapa"}
                            </button>
                          </div>
                          {newHandleResult && (
                            <p style={{ fontSize: 11, margin: 0, color: newHandleResult.ok ? "#2a7a2a" : "#c0392b" }}>
                              {newHandleResult.msg}
                            </p>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* ── Section 6: Feedback ── */}
        {activeSection === "feedback" && (
          <div className="admin-section">
            <div className="admin-section-hdr">
              <h2 className="admin-section-title">Feedback</h2>
              <span className="admin-section-meta">{feedbackItems.length} svar</span>
            </div>
            {loadingFeedback ? (
              <p className="loading">Laddar…</p>
            ) : feedbackItems.length === 0 ? (
              <p className="empty">Inga feedbacksvar ännu.</p>
            ) : (
              <ul className="account-list">
                {feedbackItems.map((item) => (
                  <li key={item.id} className="account-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "0.35rem" }}>
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", width: "100%" }}>
                      <span className="account-handle" style={{ fontWeight: 600, fontSize: 12 }}>
                        {item.email ?? "Anonym"}
                      </span>
                      {item.page && (
                        <span className="account-meta" style={{ fontSize: 11, background: "rgba(28,27,25,0.06)", padding: "1px 6px", borderRadius: 3 }}>
                          {item.page}
                        </span>
                      )}
                      <span className="account-meta" style={{ marginLeft: "auto" }}>
                        {new Date(item.created_at).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: "#333", lineHeight: 1.5, margin: 0, whiteSpace: "pre-wrap" }}>{item.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── Section 7: Beta-anmälningar ── */}
        {activeSection === "betatest" && (
          <div className="admin-section">
            <div className="admin-section-hdr">
              <h2 className="admin-section-title">Beta-anmälningar</h2>
              <span className="admin-section-meta">{betaSignups.length} anmälningar</span>
            </div>
            {loadingBetaSignups ? (
              <p className="loading">Laddar…</p>
            ) : betaSignups.length === 0 ? (
              <p className="empty">Inga beta-anmälningar ännu.</p>
            ) : (
              <ul className="account-list">
                {betaSignups.map((item) => (
                  <li key={item.id} className="account-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "0.35rem" }}>
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", width: "100%" }}>
                      <a className="account-handle" href={`mailto:${item.email}`} style={{ fontWeight: 600, fontSize: 13 }}>
                        {item.email}
                      </a>
                      {item.handle && (
                        <a
                          className="account-meta"
                          href={`https://www.tiktok.com/@${item.handle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 12, background: "rgba(28,27,25,0.06)", padding: "1px 6px", borderRadius: 3 }}
                        >
                          @{item.handle}
                        </a>
                      )}
                      {item.video_url && (
                        <a
                          className="account-meta"
                          href={item.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 11, color: "#666" }}
                        >
                          Video
                        </a>
                      )}
                      <span className="account-meta" style={{ marginLeft: "auto" }}>
                        {new Date(item.created_at).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

      </div>
    </>
  );
}

function AccountRow({ a, onToggle, onDelete, onCategoryChange, onRename }: {
  a: Account;
  onToggle: (a: Account) => void;
  onDelete: (id: string) => void;
  onCategoryChange: (a: Account, cat: string) => void;
  onRename: () => void;
}) {
  return (
    <li className={`account-row${a.is_active ? "" : " account-row--inactive"}`}>
      <label className="toggle-label">
        <input type="checkbox" className="toggle-input" checked={a.is_active} onChange={() => onToggle(a)} />
        <span className="toggle-track"><span className="toggle-thumb" /></span>
      </label>
      <div className="account-info">
        <a className="account-handle" href={`https://www.tiktok.com/@${a.handle}`} target="_blank" rel="noopener noreferrer">
          @{a.handle}
        </a>
        <div className="account-fields">
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
                onRename();
              }
            }}
          />
          <select
            className="category-select"
            value={a.category ?? ""}
            onChange={(e) => onCategoryChange(a, e.target.value)}
          >
            <option value="">— Kategori —</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <span className="account-meta">
          {(a.videos?.[0]?.count ?? 0).toLocaleString("sv-SE")} videor
          {a.followers && (
            <> · {a.followers.toLocaleString("sv-SE")} följare</>
          )}
          {a.followers_updated_at && (
            <> · uppdaterad {new Date(a.followers_updated_at).toLocaleDateString("sv-SE")}</>
          )}
        </span>
      </div>
      <span className={`status-badge${a.is_active ? " status-badge--active" : ""}`}>
        {a.is_active ? "Aktiv" : "Pausad"}
      </span>
      <button className="delete-btn" onClick={() => onDelete(a.id)} aria-label="Ta bort">✕</button>
    </li>
  );
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap');

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
    max-width: 960px;
    margin: 0 auto;
    padding: 0 2rem 6rem;
  }

  .login-root {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg2);
    padding: 1.5rem;
  }

  .login-form {
    background: var(--bg1);
    border: 1px solid var(--border);
    box-shadow: 3px 3px 0 var(--ink);
    padding: 2.5rem 2rem;
    width: 100%;
    max-width: 360px;
    display: flex;
    flex-direction: column;
  }

  .logout-btn {
    background: none;
    border: 1px solid var(--border-light);
    color: var(--muted);
    font-family: 'Inter', sans-serif;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0.4rem 0.85rem;
    cursor: pointer;
    transition: border-color 0.12s, color 0.12s;
    align-self: center;
    white-space: nowrap;
  }

  .logout-btn:hover {
    border-color: var(--ink);
    color: var(--ink);
  }

  .admin-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
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
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 2.2rem;
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
    padding: 0.6rem 0.85rem;
    border-bottom: 1px solid var(--border-light);
    transition: background 0.12s, opacity 0.15s;
  }

  .account-row:last-child { border-bottom: none; }
  .account-row--inactive { opacity: 0.65; }
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

  .account-fields {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    align-items: center;
    margin-top: 2px;
  }

  .category-select {
    background: transparent;
    border: none;
    border-bottom: 1px dashed var(--border-light);
    outline: none;
    font-family: 'Inter', sans-serif;
    font-size: 10px;
    color: var(--mid);
    padding: 1px 2px;
    cursor: pointer;
    max-width: 160px;
  }

  .category-select:focus { border-bottom-color: var(--ink); }

  .accounts-divider {
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
    padding: 1rem 0 0.4rem;
  }

  .handle-chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    font-family: 'Inter', sans-serif;
    background: var(--bg2);
    border: 1px solid var(--border-light);
    color: var(--mid);
    padding: 1px 6px 1px 8px;
  }

  .handle-chip button {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
    padding: 0;
    font-family: 'Inter', sans-serif;
  }

  .handle-chip button:hover { color: #a33; }

  .week-badge {
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    background: var(--bg2);
    border: 1px solid var(--border-light);
    color: var(--mid);
    padding: 1px 6px;
    white-space: nowrap;
  }

  .account-meta {
    font-size: 10px;
    color: var(--muted);
  }

  .status-badge {
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    flex-shrink: 0;
    padding: 2px 7px;
    border-radius: 2px;
    font-weight: 600;
  }

  /* Active toggle badge (used in accounts tab) */
  .status-badge--active { color: var(--blue); font-weight: 700; }

  /* Contest video states */
  .status-badge--excluded {
    background: #fff3cd;
    color: #7a5800;
    border: 1px solid #f5c842;
  }

  .status-badge--included {
    background: #d4edda;
    color: #1a5c2a;
    border: 1px solid #82c896;
  }

  /* Contest group labels */
  .contest-group-label {
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 700;
    margin-bottom: 0.6rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .contest-group-count {
    background: var(--bg2);
    border: 1px solid var(--border-light);
    color: var(--muted);
    font-size: 9px;
    padding: 1px 6px;
    font-weight: 400;
    letter-spacing: 0;
    text-transform: none;
  }

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

  /* Tabs */
  .admin-tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--border);
    margin-bottom: 2rem;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    background: var(--bg1);
    margin-left: -2rem;
    margin-right: -2rem;
    padding: 0 2rem;
  }

  .admin-tabs::-webkit-scrollbar { display: none; }

  .admin-tab {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    white-space: nowrap;
    flex-shrink: 0;
    margin-bottom: -1px;
    padding: 0.75rem 1.25rem;
    font-family: 'Inter', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    cursor: pointer;
    transition: color 0.12s, border-color 0.12s;
  }

  .admin-tab:hover { color: var(--ink); }

  .admin-tab--active {
    color: var(--ink);
    border-bottom-color: var(--ink);
  }

  .admin-tab-meta {
    font-size: 9px;
    font-weight: 400;
    letter-spacing: 0.04em;
    text-transform: none;
    color: var(--muted);
  }

  /* Section */
  .admin-section {
    margin-top: 0;
  }

  .admin-section-hdr {
    display: flex;
    align-items: baseline;
    gap: 1rem;
    margin-bottom: 1.25rem;
  }

  .admin-section-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.2rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--ink);
  }

  .admin-section-meta {
    font-size: 10px;
    color: var(--muted);
    letter-spacing: 0.04em;
  }

  .admin-section-desc {
    font-size: 11px;
    color: var(--muted);
    margin-bottom: 1rem;
    letter-spacing: 0.02em;
    max-width: 560px;
  }

  /* Tools area inside konton section */
  .admin-tools {
    margin-top: 2rem;
    border-top: 1px solid var(--border-light);
    padding-top: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .admin-tool-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 0.6rem;
  }

  .admin-tool-desc {
    font-size: 11px;
    color: var(--muted);
    margin-bottom: 0.75rem;
    letter-spacing: 0.02em;
  }

  .verktyg-section {
    margin-top: 1.5rem;
    border-top: 1px solid var(--border-light);
  }

  .verktyg-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    background: none;
    border: none;
    padding: 0.75rem 0;
    font-family: 'Inter', sans-serif;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
    cursor: pointer;
    transition: color 0.12s;
  }

  .verktyg-toggle:hover { color: var(--ink); }

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