import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, COOKIE_NAME } from "@/lib/dashboardAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import LogoutButton from "../components/LogoutButton";
import CompareClient from "./CompareClient";

interface OwnHandle {
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
}

async function fetchOwnHandles(handles: string[]): Promise<OwnHandle[]> {
  if (handles.length === 0) return [];
  const { data } = await supabaseAdmin
    .from("accounts")
    .select("handle, display_name, avatar_url")
    .in("handle", handles);
  return data ?? [];
}

async function fetchSavedHandles(userId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("compare_handles")
    .eq("id", userId)
    .single();
  if (error || !data) return [];
  const stored: string[] = data.compare_handles ?? [];
  if (stored.length === 0) return [];
  const { data: existing } = await supabaseAdmin
    .from("accounts")
    .select("handle")
    .in("handle", stored)
    .eq("is_active", true);
  const valid = new Set((existing ?? []).map((a) => a.handle));
  return stored.filter((h) => valid.has(h));
}

export default async function JamforelsePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect("/dashboard/login");

  const [ownHandles, savedHandles] = await Promise.all([
    fetchOwnHandles(session.handles),
    fetchSavedHandles(session.userId),
  ]);

  return (
    <>
      <style>{styles}</style>
      <div className="db-root">
        <header className="db-header">
          <a href="/" className="db-wordmark">Sociala Raketer</a>
          <nav className="db-nav">
            <a href="/dashboard" className="db-nav-link">Dashboard</a>
            <a href="/dashboard/jamforelse" className="db-nav-link db-nav-link--active">Jämför</a>
            <a href="/hall-of-fame" className="db-nav-link">Hall of Fame</a>
          </nav>
          <LogoutButton />
        </header>

        <main className="db-main">
          <CompareClient ownHandles={ownHandles} initialSavedHandles={savedHandles} />
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

  .db-nav-link:hover { color: #EDF8FB; }
  .db-nav-link--active { color: #EDF8FB; }

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
    max-width: 1400px;
    margin: 0 auto;
    padding: 2.5rem 1.5rem 6rem;
  }
`;
