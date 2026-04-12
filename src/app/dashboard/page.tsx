import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, COOKIE_NAME } from "@/lib/dashboardAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import LogoutButton from "./components/LogoutButton";
import VideoGrid from "./components/VideoGrid";

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

  const weeks_tracked = Math.max(
    (Date.now() - new Date(account.created_at).getTime()) / (7 * 24 * 3600 * 1000),
    1
  );
  const posts_per_week = post_count / weeks_tracked;

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

function formatTrackedSince(dateStr: string): string {
  const date = new Date(dateStr);
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 3600 * 24));
  if (days < 7) return `${days} dagar`;
  if (days < 30) return `${Math.floor(days / 7)} veckor`;
  if (days < 365) return `${Math.floor(days / 30)} månader`;
  return `${Math.floor(days / 365)} år`;
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
          <span className="db-wordmark">Sociala Raketer</span>
          <LogoutButton />
        </header>

        <main className="db-main">
          {profiles.length === 0 ? (
            <p className="db-empty">Inga konton är tilldelade din profil ännu. Kontakta administratören.</p>
          ) : (
            profiles.map((p) => (
              <div key={p.handle} className="db-profile-block">

                {/* ── Identity ── */}
                <div className="db-identity">
                  {p.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatar_url} alt={p.handle} className="db-avatar" />
                  ) : (
                    <div className="db-avatar db-avatar--placeholder" />
                  )}
                  <div className="db-identity-info">
                    <h1 className="db-displayname">{p.display_name ?? `@${p.handle}`}</h1>
                    <p className="db-handle">@{p.handle}</p>
                    <p className="db-meta">
                      {p.followers != null ? `${p.followers.toLocaleString("sv-SE")} följare · ` : ""}
                      Spårad i {formatTrackedSince(p.tracked_since)}
                    </p>
                  </div>
                </div>

                {/* ── Stats ── */}
                <div className="db-stats">
                  <div className="db-stat">
                    <span className="db-stat-value">
                      {p.avg_er != null ? `${p.avg_er.toFixed(2)}%` : "—"}
                    </span>
                    <span className="db-stat-label">Snitt-ER</span>
                  </div>
                  <div className="db-stat">
                    <span className="db-stat-value">{p.post_count}</span>
                    <span className="db-stat-label">Videor spårade</span>
                  </div>
                  <div className="db-stat">
                    <span className="db-stat-value">
                      {p.posts_per_week >= 1
                        ? `${p.posts_per_week.toFixed(1)}/vecka`
                        : `${(p.posts_per_week * 4.33).toFixed(1)}/mån`}
                    </span>
                    <span className="db-stat-label">Publiceringsfrekvens</span>
                  </div>
                </div>

              </div>
            ))
          )}
          <VideoGrid />

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
    font-family: 'VT323', monospace;
    font-size: 22px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
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
    max-width: 900px;
    margin: 0 auto;
    padding: 2.5rem 1.5rem 6rem;
  }

  .db-empty {
    font-size: 14px;
    color: #888;
    padding: 3rem 0;
  }

  .db-profile-block {
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
