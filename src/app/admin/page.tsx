"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  username: string;
  is_active: boolean;
  created_at: string;
  notes: string | null;
  last_seen_at: string | null;
  active_days: number | null;
  handles: string[];
}

const USD_TO_SEK = 10.5; // approximate, update as needed
const COST_USD_PER_RESULT = 4 / 1000;

function costSEK(results: number): string {
  const sek = results * COST_USD_PER_RESULT * USD_TO_SEK;
  return sek.toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " kr";
}

function relativeDate(iso: string | null): string {
  if (!iso) return "aldrig";
  const diffMs = Date.now() - new Date(iso).getTime();
  const day = 24 * 60 * 60 * 1000;
  const days = Math.floor(diffMs / day);
  if (days <= 0) return "idag";
  if (days === 1) return "igår";
  if (days < 7) return `${days} dagar sedan`;
  if (days < 30) return `${Math.floor(days / 7)} v sedan`;
  if (days < 365) return `${Math.floor(days / 30)} mån sedan`;
  return `${Math.floor(days / 365)} år sedan`;
}

function loginSummary(u: { last_seen_at: string | null; active_days: number | null }): string {
  const count = u.active_days ?? 0;
  if (!u.last_seen_at) return "Aldrig aktiv";
  const word = count === 1 ? "aktiv dag" : "aktiva dagar";
  return `${count} ${word} · senast ${relativeDate(u.last_seen_at)}`;
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
  thumbnail_url: string | null;
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
  thumbnail_url: string | null;
  caption: string | null;
  views: number | null;
  published_at: string | null;
  contest_approved: boolean;
  accounts: { display_name: string | null; avatar_url: string | null } | { display_name: string | null; avatar_url: string | null }[] | null;
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
  avatar_url: string | null;
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

  const [followerSnapping, setFollowerSnapping] = useState(false);
  const [followerSnapMsg, setFollowerSnapMsg] = useState("");
  async function handleFollowerSnapshot() {
    setFollowerSnapping(true);
    setFollowerSnapMsg("Kör Apify — kan ta upp till 4 min…");
    const res = await fetch("/api/cron/follower-snapshot", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setFollowerSnapMsg(`Klar · ${data.captured ?? 0} konton snapshottade`);
    } else {
      setFollowerSnapMsg(`Fel: ${data.error}`);
    }
    setFollowerSnapping(false);
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

  async function handleImpersonate(userId: string) {
    const res = await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      window.open("/dashboard", "_blank");
    } else {
      alert("Kunde inte öppna dashboarden — kolla att du är inloggad som admin.");
    }
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
            style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0.7rem 0.85rem", width: "100%", marginBottom: "0.75rem", background: "var(--bg1)" }}
            type="password"
            placeholder="Lösenord"
            value={pwInput}
            onChange={(e) => { setPwInput(e.target.value); setPwError(false); }}
            autoFocus
          />
          {pwError && <p className="form-error">Fel lösenord. Försök igen.</p>}
          <button className="add-btn" type="submit" style={{ padding: "0.75rem", alignSelf: "auto", borderRadius: 8, borderLeft: "none" }}>
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
                  style={{ flex: 2, border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg1)" }}
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
                <div className="admin-tool">
                  <p className="admin-tool-label">Följarsnapshot</p>
                  <p className="admin-tool-desc">Kör daglig följar-snapshot manuellt för dashboard-kopplade konton. Skriver till follower_history. Kör annars automatiskt kl 03:00 UTC varje dag.</p>
                  <button className="scrape-btn" onClick={handleFollowerSnapshot} disabled={followerSnapping}>
                    {followerSnapping ? "Hämtar…" : "Hämta följarantal nu"}
                  </button>
                  {followerSnapMsg && <p className="scrape-msg">{followerSnapMsg}</p>}
                </div>
              </div>
            )}
          </div>
        </div>

        }

        {/* ── Section 2: Tävlingsvideor ── */}
        {activeSection === "tavlingar" && (() => {
          const pendingCount = contestVideos.filter(v => !v.contest_approved).length;
          const approvedCount = contestVideos.filter(v => v.contest_approved).length;

          function groupByWeek(videos: ContestVideo[]): [string, ContestVideo[]][] {
            const buckets = new Map<string, ContestVideo[]>();
            for (const v of videos) {
              const key = v.published_at ? toWeekLabel(v.published_at) : "Okänt datum";
              const list = buckets.get(key) ?? [];
              list.push(v);
              buckets.set(key, list);
            }
            return [...buckets.entries()];
          }

          function ContestRow({ v }: { v: ContestVideo }) {
            const acct = Array.isArray(v.accounts) ? v.accounts[0] : v.accounts;
            const name = acct?.display_name ?? `@${v.handle}`;
            const [expanded, setExpanded] = useState(false);
            const captionLong = (v.caption?.length ?? 0) > 100;
            return (
              <li key={v.id} className={`contest-card${v.contest_approved ? " approved" : ""}`}>
                <a className="contest-thumb" href={v.video_url} target="_blank" rel="noopener noreferrer">
                  <span className={`status-badge ${v.contest_approved ? "status-badge--included" : "status-badge--excluded"}`}>
                    {v.contest_approved ? "Inkluderad" : "Utesluten"}
                  </span>
                  {v.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.thumbnail_url} alt="" />
                  ) : (
                    <span className="contest-thumb-fallback">{name.charAt(0).toUpperCase()}</span>
                  )}
                </a>
                <div className="contest-body">
                  <a className="contest-name" href={v.video_url} target="_blank" rel="noopener noreferrer">
                    {name}
                  </a>
                  {v.caption && (
                    <p className={`contest-caption${expanded ? " expanded" : ""}`}>{v.caption}</p>
                  )}
                  {captionLong && (
                    <button
                      type="button"
                      className="contest-caption-toggle"
                      onClick={() => setExpanded((x) => !x)}
                    >
                      {expanded ? "Visa mindre" : "Visa mer"}
                    </button>
                  )}
                  <span className="contest-meta">
                    {v.published_at && new Date(v.published_at).toLocaleDateString("sv-SE")}
                    {v.views ? ` · ${v.views.toLocaleString("sv-SE")} visningar` : ""}
                  </span>
                </div>
                <div className="contest-actions">
                  <button
                    className="scrape-btn contest-action-btn"
                    onClick={() => handleContestToggle(v)}
                  >
                    {v.contest_approved ? "Återflagga" : "Godkänn för rankning"}
                  </button>
                </div>
              </li>
            );
          }

          function WeekGroup({ label, videos }: { label: string; videos: ContestVideo[] }) {
            return (
              <div className="contest-week-group">
                <p className="contest-week-label">{label} <span className="contest-week-count">{videos.length}</span></p>
                <ul className="contest-list">
                  {videos.map(v => <ContestRow key={v.id} v={v} />)}
                </ul>
              </div>
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
              ) : contestVideos.length === 0 ? (
                <p className="loading">Inga flaggade videor.</p>
              ) : (
                <>
                  <p className="contest-group-label" style={{ marginTop: "0.5rem" }}>
                    {pendingCount} att granska
                    {approvedCount > 0 && (
                      <span className="contest-group-count">{approvedCount} godkända</span>
                    )}
                  </p>
                  {groupByWeek(contestVideos).map(([week, vids]) => (
                    <WeekGroup key={week} label={week} videos={vids} />
                  ))}
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
          <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "0 1px 2px rgba(28,27,25,0.04)", padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
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
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                Cachat innehåll räknas inte mot gränsen.
              </span>
            </div>
            {calcUsage && (
              <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", borderTop: "1px solid var(--border-light)", paddingTop: "0.75rem" }}>
                <div>
                  <span style={{ fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", display: "block", marginBottom: 3 }}>Idag</span>
                  <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: calcUsage.today >= calcDailyLimit ? "#b30000" : "var(--ink)" }}>
                    {calcUsage.today}
                  </span>
                  <span style={{ fontSize: 14, color: "var(--muted)", marginLeft: 4 }}>/ {calcDailyLimit}</span>
                </div>
                <div>
                  <span style={{ fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", display: "block", marginBottom: 3 }}>Denna vecka</span>
                  <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: "var(--ink)" }}>{calcUsage.week}</span>
                </div>
                <div>
                  <span style={{ fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", display: "block", marginBottom: 3 }}>Denna månad</span>
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
          <div className="calc-sort-row">
            {[
              { key: "newest", label: "Senaste" },
              { key: "oldest", label: "Äldsta" },
              { key: "er", label: "Eng.rate" },
              { key: "handle", label: "Handle" },
            ].map((opt) => (
              <button
                key={opt.key}
                className={`calc-sort-pill${calcSort === opt.key ? " active" : ""}`}
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
              <table className="calc-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Handle</th>
                    <th className="right">Visningar</th>
                    <th className="right">Eng.rate</th>
                    <th>Testad</th>
                    <th>Källa</th>
                    <th></th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {calcTests.map((t) => {
                    const alreadyTracked = accounts.some((a) => a.handle === t.handle);
                    const feedback = t.handle ? addFeedback[t.handle] : undefined;
                    const acct = accounts.find((a) => a.handle === t.handle);
                    const fallbackChar = (t.handle ?? "?").charAt(0).toUpperCase();
                    return (
                      <tr key={t.id}>
                        <td className="calc-thumb-cell">
                          {t.thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <a className="calc-thumb" href={t.video_url ?? "#"} target="_blank" rel="noopener noreferrer">
                              <img src={t.thumbnail_url} alt="" />
                            </a>
                          ) : acct?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <a className="calc-thumb calc-thumb--round" href={t.video_url ?? "#"} target="_blank" rel="noopener noreferrer">
                              <img src={acct.avatar_url} alt="" />
                            </a>
                          ) : (
                            <span className="calc-thumb calc-thumb--round calc-thumb--fallback">{fallbackChar}</span>
                          )}
                        </td>
                        <td style={{ fontWeight: 600 }}>{t.handle ? `@${t.handle}` : "—"}</td>
                        <td className="right" style={{ color: "var(--mid)" }}>
                          {t.views != null ? t.views.toLocaleString("sv-SE") : "—"}
                        </td>
                        <td className="right" style={{ color: "var(--mid)" }}>
                          {t.engagement_rate != null ? `${Number(t.engagement_rate).toFixed(2)}%` : "—"}
                        </td>
                        <td style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>
                          {new Date(t.tested_at).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}
                        </td>
                        <td>
                          {t.source === "db" ? (
                            <span className="src-pill src-pill--db">DB</span>
                          ) : t.source === "apify" ? (
                            <span className="src-pill src-pill--apify" title={`Kostnad ${costSEK(1)}`}>Apify</span>
                          ) : (
                            <span style={{ color: "var(--muted)" }}>—</span>
                          )}
                        </td>
                        <td>
                          {t.video_url && (
                            <a href={t.video_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink)", fontSize: 13, textDecoration: "underline" }}>
                              Video
                            </a>
                          )}
                        </td>
                        <td>
                          {t.handle && (
                            feedback ? (
                              <span style={{ fontSize: 14, color: feedback === "Tillagd!" ? "#3a7a3a" : "#9c2828" }}>{feedback}</span>
                            ) : alreadyTracked ? (
                              <span style={{ fontSize: 14, color: "var(--muted)" }}>Trackas</span>
                            ) : (
                              <button
                                className="scrape-btn"
                                style={{ fontSize: 14, padding: "0.3rem 0.7rem" }}
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
              <table className="calc-table">
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
                    const statusColor = r.status === "completed" ? "#3a7a3a" : r.status === "failed" ? "#9c2828" : "#a07020";
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
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                          <span className="account-handle" style={{ fontSize: 15 }}>{u.username}</span>
                          <span className="user-login-meta">{loginSummary(u)}</span>
                        </div>
                        <span className="account-meta" title="Skapad">{new Date(u.created_at).toLocaleDateString("sv-SE")}</span>
                        <button
                          className="user-link-btn"
                          onClick={() => handleImpersonate(u.id)}
                          title="Öppna användarens dashboard i en ny flik"
                        >
                          Visa dashboard
                        </button>
                        <button
                          className="user-link-btn"
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
                            style={{ border: "1px solid var(--border)", padding: "0.4rem 0.6rem", fontSize: 13, width: 200 }}
                            autoFocus
                          />
                          <button
                            className="scrape-btn"
                            style={{ fontSize: 13, padding: "0.25rem 0.75rem", boxShadow: "none" }}
                            onClick={() => handleChangePassword(u.id)}
                            disabled={!pwChangeValue.trim()}
                          >
                            Spara
                          </button>
                        </div>
                      )}

                      <div className="user-handles">
                        {u.handles.map((h) => {
                          const acct = accounts.find((a) => a.handle === h);
                          return (
                            <span key={h} className="handle-chip">
                              <span className="handle-chip-avatar">
                                {acct?.avatar_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={acct.avatar_url} alt="" />
                                ) : (
                                  <span>{h.charAt(0).toUpperCase()}</span>
                                )}
                              </span>
                              @{h}
                              <button onClick={() => handleRemoveHandleFromUser(u.id, h)} aria-label="Ta bort handle">×</button>
                            </span>
                          );
                        })}
                        <button
                          className="add-handle-btn"
                          onClick={() => {
                            const opening = newHandleUserId !== u.id;
                            setNewHandleUserId(opening ? u.id : null);
                            setNewHandleInput("");
                            setNewHandleResult(null);
                          }}
                        >
                          {newHandleUserId === u.id ? "Avbryt" : "+ Lägg till konto"}
                        </button>
                      </div>

                      {/* Combined panel: pick existing OR create new */}
                      {newHandleUserId === u.id && (
                        <div className="user-add-panel">
                          {availableHandles.length > 0 && (
                            <div className="user-add-block">
                              <p className="user-add-label">Välj befintligt</p>
                              <select
                                className="user-add-select"
                                value=""
                                onChange={(e) => { if (e.target.value) { handleAddHandleToUser(u.id, e.target.value); setNewHandleUserId(null); } }}
                              >
                                <option value="">Välj konto…</option>
                                {availableHandles.map((h) => (
                                  <option key={h} value={h}>@{h}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          <div className="user-add-block">
                            <p className="user-add-label">Lägg till nytt konto</p>
                            <div className="user-add-row">
                              <input
                                className="handle-input user-add-input"
                                type="text"
                                placeholder="@handle"
                                value={newHandleInput}
                                onChange={(e) => setNewHandleInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && !newHandleLoading && handleAddNewHandle(u.id)}
                                disabled={newHandleLoading}
                                autoFocus
                              />
                              <select
                                className="user-add-select"
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
                          </div>
                          {newHandleResult && (
                            <p className="user-add-msg" style={{ color: newHandleResult.ok ? "#3a7a3a" : "#9c2828" }}>
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
              <ul className="entry-list">
                {feedbackItems.map((item) => (
                  <li key={item.id} className="entry-item entry-item--column">
                    <div className="entry-header">
                      <span className="entry-primary">{item.email ?? "Anonym"}</span>
                      {item.page && <span className="entry-pill">{item.page}</span>}
                      <span className="entry-date">
                        {new Date(item.created_at).toLocaleString("sv-SE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="entry-body">{item.message}</p>
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
              <ul className="entry-list">
                {betaSignups.map((item) => (
                  <li key={item.id} className="entry-item">
                    <a className="entry-primary entry-primary--link" href={`mailto:${item.email}`}>
                      {item.email}
                    </a>
                    {item.handle && (
                      <a
                        className="entry-pill"
                        href={`https://www.tiktok.com/@${item.handle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        @{item.handle}
                      </a>
                    )}
                    {item.video_url && (
                      <a
                        className="entry-link"
                        href={item.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Video
                      </a>
                    )}
                    <span className="entry-date">
                      {new Date(item.created_at).toLocaleString("sv-SE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
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
      <div className="account-avatar">
        {a.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.avatar_url} alt="" />
        ) : (
          <span className="account-avatar-fallback">
            {(a.display_name?.charAt(0) || a.handle.charAt(0) || "?").toUpperCase()}
          </span>
        )}
      </div>
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
  :root {
    --bg1:    #ffffff;
    --bg2:    #EBE7E2;
    --bg3:    rgba(28,27,25,0.04);
    --blue:   #1C1B19;
    --ink:    #1C1B19;
    --mid:    rgba(28,27,25,0.78);
    --muted:  rgba(28,27,25,0.6);
    --border: rgba(28,27,25,0.14);
    --border-light: rgba(28,27,25,0.08);
    --accent: #C8962A;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body { background: var(--bg2); }

  .admin-root {
    background: var(--bg2);
    color: var(--ink);
    min-height: 100vh;
    font-family: 'Barlow', sans-serif;
    max-width: 1040px;
    margin: 0 auto;
    padding: 0 1.5rem 6rem;
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
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(28,27,25,0.08), 0 4px 16px rgba(28,27,25,0.06);
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
    font-family: 'Barlow', sans-serif;
    font-size: 13px;
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
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
    display: block;
    margin-bottom: 0.5rem;
  }

  .admin-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 2.5rem;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 0.25rem;
    color: var(--ink);
    letter-spacing: -0.005em;
  }

  .admin-sub {
    font-size: 14px;
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
    border-radius: 8px;
    box-shadow: 0 1px 2px rgba(28,27,25,0.04);
    transition: border-color 0.12s, box-shadow 0.12s;
  }

  .input-row:focus-within {
    border-color: var(--ink);
    box-shadow: 0 1px 3px rgba(28,27,25,0.1);
  }

  .at-sign {
    padding: 0 0.6rem;
    font-size: 14px;
    color: var(--muted);
    flex-shrink: 0;
  }

  .handle-input {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: none;
    outline: none;
    color: var(--ink);
    font-family: 'Barlow', sans-serif;
    font-size: 14px;
    padding: 0.7rem 0.85rem;
  }

  .handle-input::placeholder { color: var(--muted); }

  .add-btn {
    background: var(--ink);
    border: none;
    border-left: 1px solid rgba(28,27,25,0.4);
    color: #EBE7E2;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0 1.4rem;
    align-self: stretch;
    cursor: pointer;
    transition: opacity 0.15s;
    white-space: nowrap;
  }

  .add-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .add-btn:not(:disabled):hover { opacity: 0.88; }

  .form-error {
    margin-top: 0.5rem;
    font-size: 14px;
    color: #a33;
  }

  /* List */
  .loading, .empty {
    color: var(--muted);
    font-size: 14px;
    padding: 2rem 0;
    letter-spacing: 0.04em;
  }

  .account-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0;
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(28,27,25,0.04);
    background: var(--bg1);
  }

  .account-row {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 0.7rem 1rem;
    border-bottom: 1px solid var(--border-light);
    transition: background 0.12s, opacity 0.15s;
  }

  .account-row:last-child { border-bottom: none; }
  .account-row--inactive { opacity: 0.55; }
  .account-row:hover { background: var(--bg3); opacity: 1; }

  /* Toggle */
  .toggle-label { display: flex; align-items: center; cursor: pointer; flex-shrink: 0; }
  .toggle-input { display: none; }

  .toggle-track {
    width: 34px;
    height: 20px;
    background: rgba(28,27,25,0.12);
    border: none;
    border-radius: 999px;
    position: relative;
    transition: background 0.2s;
  }

  .toggle-input:checked + .toggle-track {
    background: var(--ink);
  }

  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background: #fff;
    border-radius: 50%;
    box-shadow: 0 1px 2px rgba(28,27,25,0.18);
    transition: transform 0.2s, background 0.2s;
  }

  .toggle-input:checked + .toggle-track .toggle-thumb {
    transform: translateX(14px);
  }

  /* Avatar */
  .account-avatar {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--bg3);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .account-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .account-avatar-fallback {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 16px;
    color: var(--muted);
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
    font-size: 13px;
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
    font-family: 'Barlow', sans-serif;
    font-size: 13px;
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
    font-family: 'Barlow', sans-serif;
    font-size: 13px;
    color: var(--mid);
    padding: 1px 2px;
    cursor: pointer;
    max-width: 160px;
  }

  .category-select:focus { border-bottom-color: var(--ink); }

  .accounts-divider {
    font-size: 13px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
    padding: 1rem 0 0.4rem;
  }

  .handle-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-family: 'Barlow', sans-serif;
    background: var(--bg1);
    border: 1px solid var(--border-light);
    color: var(--ink);
    padding: 2px 8px 2px 4px;
    border-radius: 999px;
  }
  .handle-chip-avatar {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--bg3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 14px;
    color: var(--muted);
  }
  .handle-chip-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .handle-chip button {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 0;
    font-family: 'Barlow', sans-serif;
  }

  .handle-chip button:hover { color: #a33; }

  .week-badge {
    font-size: 13px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    background: var(--bg2);
    border: 1px solid var(--border-light);
    color: var(--mid);
    padding: 1px 6px;
    white-space: nowrap;
  }

  .account-meta {
    font-size: 13px;
    color: var(--muted);
  }

  .status-badge {
    font-size: 13px;
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
    font-size: 13px;
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
    font-size: 13px;
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
    font-size: 14px;
    padding: 0.2rem 0.3rem;
    flex-shrink: 0;
    transition: color 0.12s;
    font-family: 'Barlow', sans-serif;
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
    margin-left: -1.5rem;
    margin-right: -1.5rem;
    padding: 0 1.5rem;
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
    padding: 0.85rem 1.25rem;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 14px;
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
    font-size: 13px;
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
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--ink);
  }

  .admin-section-meta {
    font-size: 13px;
    color: var(--muted);
    letter-spacing: 0.04em;
  }

  .admin-section-desc {
    font-size: 14px;
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
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 0.6rem;
  }

  .admin-tool-desc {
    font-size: 14px;
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
    font-family: 'Barlow', sans-serif;
    font-size: 13px;
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
    border-radius: 8px;
    padding: 0.5rem 0.85rem;
    box-shadow: 0 1px 2px rgba(28,27,25,0.04);
  }

  .days-input {
    width: 52px;
    background: transparent;
    border: none;
    outline: none;
    font-family: 'Barlow', sans-serif;
    font-size: 14px;
    color: var(--ink);
    text-align: center;
  }

  .days-label {
    font-size: 13px;
    color: var(--muted);
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  .scrape-btn {
    background: var(--ink);
    border: 1px solid var(--ink);
    color: #EBE7E2;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0.6rem 1.25rem;
    border-radius: 999px;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .scrape-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .scrape-btn:not(:disabled):hover { opacity: 0.88; }

  .scrape-msg {
    margin-top: 0.75rem;
    font-size: 14px;
    color: var(--mid);
    letter-spacing: 0.02em;
  }

  /* Contest videos (Tävlingar) — card grid */
  .contest-week-group {
    margin-bottom: 1.75rem;
  }
  .contest-week-label {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
    margin: 1.25rem 0 0.6rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .contest-week-count {
    background: var(--bg3);
    color: var(--muted);
    font-size: 14px;
    font-weight: 400;
    letter-spacing: 0;
    padding: 1px 7px;
    border-radius: 999px;
  }
  .contest-list {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 14px;
  }
  .contest-card {
    display: flex;
    flex-direction: column;
    background: var(--bg1);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(28,27,25,0.04);
    transition: opacity 0.18s, box-shadow 0.18s, transform 0.18s;
  }
  .contest-card:hover {
    box-shadow: 0 2px 8px rgba(28,27,25,0.08);
  }
  .contest-card.approved {
    opacity: 0.42;
  }
  .contest-card.approved:hover {
    opacity: 0.85;
  }
  .contest-thumb {
    display: block;
    width: 100%;
    aspect-ratio: 4 / 5;
    overflow: hidden;
    background: var(--bg3);
    position: relative;
  }
  .contest-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top;
    display: block;
  }
  .contest-thumb-fallback {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 36px;
    color: var(--muted);
  }
  .contest-card .status-badge {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 2;
  }
  .contest-body {
    padding: 0.7rem 0.85rem 0.55rem;
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }
  .contest-name {
    font-size: 14px;
    font-weight: 700;
    color: var(--ink);
    text-decoration: none;
    line-height: 1.25;
  }
  .contest-name:hover { text-decoration: underline; }
  .contest-caption {
    font-size: 13px;
    color: var(--mid);
    font-style: italic;
    line-height: 1.4;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .contest-caption.expanded {
    display: block;
    -webkit-line-clamp: unset;
    overflow: visible;
  }
  .contest-caption-toggle {
    align-self: flex-start;
    background: none;
    border: none;
    padding: 0;
    margin-top: -2px;
    font-family: 'Barlow', sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: var(--ink);
    text-decoration: underline;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.12s;
  }
  .contest-caption-toggle:hover { opacity: 1; }
  .contest-meta {
    font-size: 14px;
    color: var(--muted);
    margin-top: auto;
    padding-top: 4px;
  }
  .contest-actions {
    padding: 0 0.85rem 0.85rem;
    display: flex;
  }
  .contest-action-btn {
    font-size: 13px;
    padding: 0.45rem 0.9rem;
    width: 100%;
  }

  /* Kalkylator-tester sort pills */
  .calc-sort-row {
    display: inline-flex;
    background: var(--bg3);
    border-radius: 999px;
    padding: 4px;
    margin-bottom: 1rem;
    gap: 0;
  }
  .calc-sort-pill {
    font-family: 'Barlow', sans-serif;
    font-size: 14px;
    font-weight: 500;
    color: var(--mid);
    background: transparent;
    border: none;
    padding: 5px 14px;
    border-radius: 999px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .calc-sort-pill:hover { color: var(--ink); }
  .calc-sort-pill.active {
    background: var(--bg1);
    color: var(--ink);
    box-shadow: 0 1px 2px rgba(28,27,25,0.1);
  }

  /* Användare — login summary subtext */
  .user-login-meta {
    font-size: 13px;
    color: var(--muted);
    letter-spacing: 0.01em;
  }

  /* Användare — link-style action button (Byt lösenord) */
  .user-link-btn {
    background: none;
    border: none;
    color: var(--mid);
    font-family: 'Barlow', sans-serif;
    font-size: 13px;
    padding: 4px 6px;
    cursor: pointer;
    text-decoration: underline;
    transition: color 0.12s;
  }
  .user-link-btn:hover { color: var(--ink); }

  /* Användare — handle chips + add-account panel */
  .user-handles {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding-left: 2.75rem;
    align-items: center;
  }
  .add-handle-btn {
    font-family: 'Barlow', sans-serif;
    font-size: 13px;
    font-weight: 500;
    color: var(--mid);
    background: var(--bg3);
    border: 1px dashed var(--border);
    padding: 4px 12px;
    border-radius: 999px;
    cursor: pointer;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }
  .add-handle-btn:hover {
    color: var(--ink);
    border-color: var(--ink);
    background: var(--bg1);
  }

  .user-add-panel {
    margin-left: 2.75rem;
    margin-top: 4px;
    background: var(--bg3);
    border: 1px solid var(--border-light);
    border-radius: 10px;
    padding: 0.85rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  .user-add-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .user-add-label {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
    margin: 0;
  }
  .user-add-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .user-add-input {
    flex: 1;
    min-width: 160px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg1);
    padding: 0.55rem 0.75rem;
  }
  .user-add-select {
    background: var(--bg1);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.55rem 0.75rem;
    font-family: 'Barlow', sans-serif;
    font-size: 14px;
    color: var(--ink);
    cursor: pointer;
  }
  .user-add-msg {
    font-size: 13px;
    margin: 0;
  }

  /* Shared list for Feedback / Beta-anmälningar */
  .entry-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0;
    background: var(--bg1);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(28,27,25,0.04);
  }
  .entry-item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    padding: 0.8rem 1rem;
    border-bottom: 1px solid var(--border-light);
    transition: background 0.12s;
  }
  .entry-item:last-child { border-bottom: none; }
  .entry-item:hover { background: var(--bg3); }
  .entry-item--column { flex-direction: column; align-items: flex-start; gap: 0.5rem; }
  .entry-item--column .entry-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
  }
  .entry-primary {
    font-size: 14px;
    font-weight: 700;
    color: var(--ink);
  }
  .entry-primary--link {
    text-decoration: none;
  }
  .entry-primary--link:hover { text-decoration: underline; }
  .entry-pill {
    font-family: 'Barlow', sans-serif;
    font-size: 13px;
    color: var(--mid);
    background: var(--bg3);
    padding: 2px 8px;
    border-radius: 999px;
    text-decoration: none;
  }
  .entry-pill:hover { color: var(--ink); }
  .entry-link {
    font-size: 14px;
    color: var(--ink);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .entry-link:hover { opacity: 0.7; }
  .entry-date {
    font-size: 13px;
    color: var(--muted);
    margin-left: auto;
    white-space: nowrap;
  }
  .entry-body {
    font-size: 14px;
    color: var(--ink);
    line-height: 1.55;
    margin: 0;
    white-space: pre-wrap;
  }

  /* Calc-test thumbnail / avatar cell */
  .calc-thumb-cell {
    width: 56px;
    padding: 0.4rem 0 0.4rem 0.85rem !important;
  }
  .calc-thumb {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 50px;
    border-radius: 6px;
    overflow: hidden;
    background: var(--bg3);
    text-decoration: none;
  }
  .calc-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top;
    display: block;
  }
  .calc-thumb--round {
    width: 40px;
    height: 40px;
    border-radius: 50%;
  }
  .calc-thumb--fallback {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 16px;
    color: var(--muted);
  }

  /* Source badge (DB / Apify) */
  .src-pill {
    display: inline-block;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: 999px;
  }
  .src-pill--db { background: #d4ebd4; color: #2a5a2a; }
  .src-pill--apify { background: var(--bg3); color: var(--mid); }

  /* Tables (scrape-log, kalkylator-tester) */
  .calc-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    background: var(--bg1);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(28,27,25,0.04);
    font-family: 'Barlow', sans-serif;
  }
  .calc-table thead tr {
    background: var(--bg3);
  }
  .calc-table th {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    text-align: left;
    padding: 0.7rem 0.85rem;
    border-bottom: 1px solid var(--border-light);
    white-space: nowrap;
  }
  .calc-table th.right { text-align: right; }
  .calc-table td {
    padding: 0.6rem 0.85rem;
    font-size: 14px;
    color: var(--ink);
    border-bottom: 1px solid var(--border-light);
    vertical-align: middle;
  }
  .calc-table tbody tr:last-child td { border-bottom: none; }
  .calc-table tbody tr:hover { background: var(--bg3); }
  .calc-table td.right { text-align: right; }
`;