import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, COOKIE_NAME } from "@/lib/dashboardAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import LogoutButton from "./components/LogoutButton";
import DashboardClient from "./components/DashboardClient";

interface ProfileData {
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  followers: number | null;
  tracked_since: string;
  post_count: number;
  avg_er: number | null;
  posts_per_week: number;
}

async function fetchProfile(handle: string): Promise<ProfileData | null> {
  const [{ data: account }, { data: videos }] = await Promise.all([
    supabaseAdmin
      .from("accounts")
      .select("handle, display_name, avatar_url, followers, created_at")
      .eq("handle", handle)
      .single(),
    supabaseAdmin
      .from("videos")
      .select("engagement_rate, published_at")
      .eq("handle", handle),
  ]);

  if (!account) return null;

  const post_count = videos?.length ?? 0;

  const erValues = (videos ?? [])
    .filter((v) => v.engagement_rate != null)
    .map((v) => Number(v.engagement_rate));

  const avg_er =
    erValues.length > 0
      ? erValues.reduce((sum, er) => sum + er, 0) / erValues.length
      : null;

  const publishedTimestamps = (videos ?? [])
    .filter((v) => v.published_at)
    .map((v) => new Date(v.published_at!).getTime());

  const spanMs =
    publishedTimestamps.length >= 2
      ? Math.max(...publishedTimestamps) - Math.min(...publishedTimestamps)
      : 0;

  // Use the actual video date range; fall back to 1 week minimum to avoid inflating frequency
  const weeks_span = Math.max(spanMs / (7 * 24 * 3600 * 1000), 1);
  const posts_per_week = post_count / weeks_span;

  return {
    handle: account.handle,
    display_name: account.display_name,
    avatar_url: account.avatar_url,
    followers: account.followers,
    tracked_since: account.created_at,
    post_count,
    avg_er,
    posts_per_week,
  };
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect("/dashboard/login");

  const profiles = (
    await Promise.all(session.handles.map(fetchProfile))
  ).filter(Boolean) as ProfileData[];

  return (
    <>
      <style>{styles}</style>
      <div className="db-root">

        <header className="db-header">
          <a href="/" className="db-wordmark">Sociala Raketer</a>
          <nav className="db-nav">
            <a href="/dashboard" className="db-nav-link">Dashboard</a>
            <a href="/hall-of-fame" className="db-nav-link">Hall of Fame</a>
          </nav>
          <LogoutButton />
        </header>

        <main className="db-main">
          {profiles.length === 0 ? (
            <p className="db-empty">Inga konton är tilldelade din profil ännu. Kontakta administratören.</p>
          ) : (
            <DashboardClient profiles={profiles} />
          )}
        </main>

      </div>
    </>
  );
}

const styles = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .db-root {
    min-height: 100vh;
    background: #EBE7E2;
    font-family: 'Barlow', sans-serif;
    color: #1C1B19;
  }

  .db-header {
    position: sticky;
    top: 0;
    z-index: 100;
    background: #1C1B19;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1.5rem;
    height: 52px;
  }

  .db-wordmark {
    font-family: 'Jersey 10', sans-serif;
    font-size: 22px;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: #EDF8FB;
    text-decoration: none;
  }

  .db-nav {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    margin-left: auto;
    margin-right: 1.5rem;
  }

  .db-nav-link {
    font-family: 'Barlow', sans-serif;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(237,248,251,0.55);
    text-decoration: none;
    transition: color 0.12s;
  }

  .db-nav-link:hover {
    color: #EDF8FB;
  }

  .db-logout-btn {
    background: none;
    border: 1px solid rgba(237,248,251,0.2);
    color: rgba(237,248,251,0.6);
    font-family: 'Barlow', sans-serif;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0.35rem 0.85rem;
    cursor: pointer;
    transition: border-color 0.12s, color 0.12s;
  }

  .db-logout-btn:hover {
    border-color: rgba(237,248,251,0.6);
    color: #EDF8FB;
  }

  .db-main {
    max-width: 100%;
    margin: 0 auto;
    padding: 2.5rem 1.5rem 6rem;
  }

  .db-empty {
    font-size: 14px;
    color: #888;
    padding: 3rem 0;
  }

  .db-profile-block {
    max-width: 860px;
    margin-bottom: 2.5rem;
  }

  /* Identity row */
  .db-identity {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    margin-bottom: 1.5rem;
  }

  .db-avatar {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    border: 2px solid rgba(28,27,25,0.1);
  }

  .db-avatar--placeholder {
    background: rgba(28,27,25,0.1);
  }

  .db-identity-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .db-displayname {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.75rem;
    font-weight: 700;
    line-height: 1;
    color: #1C1B19;
  }

  .db-handle {
    font-size: 13px;
    color: #888;
  }

  .db-meta {
    font-size: 12px;
    color: #888;
    margin-top: 2px;
  }

  /* Stats */
  .db-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }

  @media (max-width: 480px) {
    .db-stats { grid-template-columns: 1fr 1fr; }
  }

  .db-stat {
    background: #fff;
    border: 1px solid rgba(28,27,25,0.1);
    padding: 1.1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .db-stat-value {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 2rem;
    font-weight: 700;
    line-height: 1;
    color: #1C1B19;
  }

  .db-stat-label {
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #888;
  }
`;
