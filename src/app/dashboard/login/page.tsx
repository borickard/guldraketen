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
        <div className="dl-card">
          <a href="/" className="dl-wordmark">Sociala Raketer</a>

          <div className="dl-intro">
            <h1 className="dl-title">Välkommen</h1>
            <p className="dl-lead">
              Det här är beta-versionen av Sociala Raketer-dashboarden. Här
              ser du dina TikTok-siffror — följare över tid, vanliga
              benchmarks och varje publicerad video, vecka för vecka.
            </p>
            <p className="dl-lead dl-lead--soft">
              Vi bygger fortfarande — har du synpunkter eller saknar du något?
              Använd feedbackikonen längst ner till höger.
            </p>
          </div>

          <form className="dl-form" onSubmit={handleSubmit}>
            <label className="dl-field">
              <span className="dl-field-lbl">Användarnamn</span>
              <input
                className="dl-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                autoComplete="username"
                autoFocus
              />
            </label>
            <label className="dl-field">
              <span className="dl-field-lbl">Lösenord</span>
              <input
                className="dl-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
              />
            </label>

            {error && <p className="dl-error">{error}</p>}

            <button className="dl-btn" type="submit" disabled={loading || !username.trim() || !password.trim()}>
              {loading ? "Loggar in…" : "Logga in"}
            </button>
          </form>
        </div>
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
    padding: 2rem 1.25rem;
    font-family: 'Barlow', sans-serif;
    color: #1C1B19;
  }

  .dl-card {
    background: #fff;
    border: 1px solid rgba(28,27,25,0.1);
    border-radius: 14px;
    box-shadow: 0 1px 2px rgba(28,27,25,0.04), 0 6px 24px rgba(28,27,25,0.06);
    padding: 2rem 1.75rem;
    width: 100%;
    max-width: 440px;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .dl-wordmark {
    align-self: flex-start;
    font-family: 'Jersey 10', sans-serif;
    font-size: 28px;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: #C8962A;
    text-decoration: none;
  }
  .dl-wordmark:hover { opacity: 0.85; }

  .dl-intro {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .dl-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 2rem;
    font-weight: 700;
    line-height: 1;
    color: #1C1B19;
  }
  .dl-lead {
    font-size: 14px;
    line-height: 1.55;
    color: rgba(28,27,25,0.75);
  }
  .dl-lead--soft {
    font-size: 13px;
    color: rgba(28,27,25,0.55);
  }

  .dl-form {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .dl-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .dl-field-lbl {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(28,27,25,0.55);
  }

  .dl-input {
    background: #fff;
    border: 1px solid rgba(28,27,25,0.18);
    border-radius: 8px;
    outline: none;
    font-family: 'Barlow', sans-serif;
    font-size: 15px;
    color: #1C1B19;
    padding: 0.7rem 0.85rem;
    width: 100%;
    transition: border-color 0.12s, box-shadow 0.12s;
  }
  .dl-input:focus {
    border-color: #1C1B19;
    box-shadow: 0 0 0 3px rgba(28,27,25,0.08);
  }

  .dl-error {
    font-size: 13px;
    color: #9c2828;
    margin-top: -2px;
  }

  .dl-btn {
    background: #1C1B19;
    border: none;
    color: #EBE7E2;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 0.85rem;
    border-radius: 8px;
    cursor: pointer;
    transition: opacity 0.15s;
    margin-top: 0.25rem;
  }
  .dl-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .dl-btn:not(:disabled):hover { opacity: 0.88; }
`;
