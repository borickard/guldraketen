"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardHeader({
  impersonating,
}: {
  impersonating?: { username: string } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/dashboard/logout", { method: "POST" });
    router.push("/dashboard/login");
  }

  async function handleEndImpersonation() {
    // Clears only the dashboard_session cookie — the admin_session stays so
    // the admin lands back on the admin page authenticated.
    await fetch("/api/dashboard/logout", { method: "POST" });
    router.push("/admin?tab=users");
  }

  return (
    <>
      <style>{css}</style>
      {impersonating && (
        <div className="db-impersonate-bar">
          <span className="db-impersonate-eye" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </span>
          <span className="db-impersonate-text">
            Du tittar som <strong>{impersonating.username}</strong>
          </span>
          <button onClick={handleEndImpersonation} className="db-impersonate-back">
            Tillbaka till admin
          </button>
        </div>
      )}
      <header className="db-header">
        <a href="/" className="db-wordmark">Sociala Raketer</a>

        <nav className="db-nav db-nav--desktop">
          <a href="/dashboard" className="db-nav-link">Dashboard</a>
          <a href="/dashboard/jamforelse" className="db-nav-link">Jämför</a>
          <a href="/hall-of-fame" className="db-nav-link">Hall of Fame</a>
          <a href="/dashboard/installningar" className="db-nav-link">Inställningar</a>
        </nav>
        <button onClick={handleLogout} className="db-logout-btn db-logout-btn--desktop">
          Logga ut
        </button>

        <button
          className="db-burger"
          aria-label="Öppna meny"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      {open && (
        <div className="db-mobile-menu">
          <a href="/dashboard" className="db-mobile-link" onClick={() => setOpen(false)}>Dashboard</a>
          <a href="/dashboard/jamforelse" className="db-mobile-link" onClick={() => setOpen(false)}>Jämför</a>
          <a href="/hall-of-fame" className="db-mobile-link" onClick={() => setOpen(false)}>Hall of Fame</a>
          <a href="/dashboard/installningar" className="db-mobile-link" onClick={() => setOpen(false)}>Inställningar</a>
          <button onClick={handleLogout} className="db-mobile-link db-mobile-link--btn">Logga ut</button>
        </div>
      )}
    </>
  );
}

const css = `
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

  .db-impersonate-bar {
    position: sticky;
    top: 0;
    z-index: 101;
    background: #C8962A;
    color: #1C1B19;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 8px 1.5rem;
    font-family: 'Barlow', sans-serif;
    font-size: 13px;
  }
  .db-impersonate-eye {
    display: inline-flex;
    align-items: center;
  }
  .db-impersonate-text strong {
    font-weight: 700;
  }
  .db-impersonate-back {
    margin-left: auto;
    background: rgba(28,27,25,0.12);
    border: 1px solid rgba(28,27,25,0.25);
    color: #1C1B19;
    font-family: 'Barlow', sans-serif;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 0.35rem 0.85rem;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.12s;
  }
  .db-impersonate-back:hover {
    background: rgba(28,27,25,0.2);
  }

  .db-burger {
    display: none;
    flex-direction: column;
    justify-content: space-between;
    width: 22px;
    height: 16px;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }
  .db-burger span {
    display: block;
    height: 2px;
    background: #EDF8FB;
    border-radius: 1px;
  }

  .db-mobile-menu {
    position: sticky;
    top: 52px;
    z-index: 99;
    background: #1C1B19;
    display: flex;
    flex-direction: column;
    border-top: 1px solid rgba(237,248,251,0.1);
  }
  .db-mobile-link {
    display: block;
    padding: 14px 1.5rem;
    color: #EDF8FB;
    font-family: 'Barlow', sans-serif;
    font-size: 14px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-decoration: none;
    border-bottom: 1px solid rgba(237,248,251,0.08);
  }
  .db-mobile-link--btn {
    background: none;
    border: none;
    border-bottom: 1px solid rgba(237,248,251,0.08);
    text-align: left;
    cursor: pointer;
    color: rgba(237,248,251,0.7);
  }
  .db-mobile-link:active {
    background: rgba(237,248,251,0.04);
  }

  @media (max-width: 639px) {
    .db-nav--desktop { display: none; }
    .db-logout-btn--desktop { display: none; }
    .db-burger { display: flex; }
  }
`;
