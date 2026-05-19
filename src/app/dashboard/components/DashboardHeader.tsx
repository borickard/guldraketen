"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardHeader() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/dashboard/logout", { method: "POST" });
    router.push("/dashboard/login");
  }

  return (
    <>
      <style>{css}</style>
      <header className="db-header">
        <a href="/" className="db-wordmark">Sociala Raketer</a>

        <nav className="db-nav db-nav--desktop">
          <a href="/dashboard" className="db-nav-link">Dashboard</a>
          <a href="/hall-of-fame" className="db-nav-link">Hall of Fame</a>
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
          <a href="/hall-of-fame" className="db-mobile-link" onClick={() => setOpen(false)}>Hall of Fame</a>
          <button onClick={handleLogout} className="db-mobile-link db-mobile-link--btn">Logga ut</button>
        </div>
      )}
    </>
  );
}

const css = `
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
