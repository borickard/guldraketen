"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/dashboard/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (res.ok) {
      router.push("/dashboard");
    } else {
      setError(data.error ?? "Inloggning misslyckades");
      setLoading(false);
    }
  }

  return (
    <>
      <style>{styles}</style>
      <div className="dl-root">
        <form className="dl-form" onSubmit={handleSubmit}>
          <div className="dl-logo">Sociala Raketer</div>
          <h1 className="dl-title">Dashboard</h1>
          <p className="dl-sub">Logga in för att se din TikTok-statistik</p>

          <div className="dl-fields">
            <input
              className="dl-input"
              type="text"
              placeholder="Användarnamn"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoComplete="username"
              autoFocus
            />
            <input
              className="dl-input"
              type="password"
              placeholder="Lösenord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          {error && <p className="dl-error">{error}</p>}

          <button className="dl-btn" type="submit" disabled={loading || !username.trim() || !password.trim()}>
            {loading ? "Loggar in…" : "Logga in"}
          </button>
        </form>
      </div>
    </>
  );
}

const styles = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .dl-root {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #EBE7E2;
    padding: 1.5rem;
    font-family: 'Barlow', sans-serif;
  }

  .dl-form {
    background: #fff;
    border: 1px solid rgba(28,27,25,0.12);
    box-shadow: 3px 3px 0 rgba(28,27,25,0.15);
    padding: 2.5rem 2rem;
    width: 100%;
    max-width: 360px;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .dl-logo {
    font-family: 'VT323', monospace;
    font-size: 22px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #C8962A;
    margin-bottom: 1rem;
  }

  .dl-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 2rem;
    font-weight: 700;
    color: #1C1B19;
    line-height: 1;
    margin-bottom: 0.4rem;
  }

  .dl-sub {
    font-size: 13px;
    color: #888;
    margin-bottom: 1.75rem;
  }

  .dl-fields {
    display: flex;
    flex-direction: column;
    gap: 0;
    border: 1px solid #1C1B19;
    box-shadow: 2px 2px 0 #1C1B19;
    margin-bottom: 0.75rem;
  }

  .dl-input {
    background: #fff;
    border: none;
    border-bottom: 1px solid rgba(28,27,25,0.15);
    outline: none;
    font-family: 'Barlow', sans-serif;
    font-size: 14px;
    color: #1C1B19;
    padding: 0.75rem 0.85rem;
    width: 100%;
  }

  .dl-input:last-child { border-bottom: none; }
  .dl-input::placeholder { color: #aaa; }

  .dl-error {
    font-size: 12px;
    color: #a33;
    margin-bottom: 0.75rem;
  }

  .dl-btn {
    background: #1C1B19;
    border: 1px solid #1C1B19;
    color: #fff;
    font-family: 'Barlow', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0.75rem;
    cursor: pointer;
    transition: background 0.12s;
    margin-top: 0.25rem;
  }

  .dl-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .dl-btn:not(:disabled):hover { background: #333; }
`;
