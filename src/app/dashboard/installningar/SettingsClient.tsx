"use client";

import { useEffect, useState } from "react";

interface MeData {
  username?: string;
  contact_name: string | null;
  contact_email: string | null;
}

export default function SettingsClient({ username }: { username: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loadingMe, setLoadingMe] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/me")
      .then((r) => r.json())
      .then((data: MeData) => {
        setName(data.contact_name ?? "");
        setEmail(data.contact_email ?? "");
      })
      .catch(() => {})
      .finally(() => setLoadingMe(false));
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const res = await fetch("/api/dashboard/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_name: name, contact_email: email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Något gick fel");
      setProfileMsg({ kind: "ok", text: "Kontaktuppgifter sparade." });
    } catch (err) {
      setProfileMsg({ kind: "err", text: err instanceof Error ? err.message : "Något gick fel" });
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (newPw.length < 8) {
      setPwMsg({ kind: "err", text: "Nytt lösenord måste vara minst 8 tecken." });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ kind: "err", text: "Det nya lösenordet matchar inte bekräftelsen." });
      return;
    }
    setSavingPw(true);
    try {
      const res = await fetch("/api/dashboard/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Något gick fel");
      setPwMsg({ kind: "ok", text: "Lösenordet är uppdaterat." });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      setPwMsg({ kind: "err", text: err instanceof Error ? err.message : "Något gick fel" });
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <>
      <style>{css}</style>

      <section className="set-card">
        <h2 className="set-card-title">Kontaktuppgifter</h2>
        <p className="set-card-meta">
          Inloggat som <strong>{username}</strong>. Kontaktuppgifterna används för att nå dig
          om något händer med ditt konto eller datan.
        </p>

        <form className="set-form" onSubmit={saveProfile}>
          <label className="set-field">
            <span className="set-label">Namn</span>
            <input
              className="set-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loadingMe || savingProfile}
              placeholder="Förnamn Efternamn"
              autoComplete="name"
            />
          </label>

          <label className="set-field">
            <span className="set-label">E-post (jobb)</span>
            <input
              className="set-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loadingMe || savingProfile}
              placeholder="namn@foretag.se"
              autoComplete="email"
            />
          </label>

          {profileMsg && (
            <p className={`set-msg set-msg--${profileMsg.kind}`}>{profileMsg.text}</p>
          )}

          <div className="set-row">
            <button
              type="submit"
              className="set-btn set-btn--primary"
              disabled={loadingMe || savingProfile}
            >
              {savingProfile ? "Sparar…" : "Spara"}
            </button>
          </div>
        </form>
      </section>

      <section className="set-card">
        <h2 className="set-card-title">Byt lösenord</h2>
        <p className="set-card-meta">
          Minst 8 tecken. Glömt nuvarande lösenord?{" "}
          <a href="mailto:rickard.berggren@gmail.com">
            Kontakta rickard.berggren@gmail.com
          </a>
        </p>

        <form className="set-form" onSubmit={savePassword}>
          <label className="set-field">
            <span className="set-label">Nuvarande lösenord</span>
            <input
              className="set-input"
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              disabled={savingPw}
              autoComplete="current-password"
            />
          </label>

          <label className="set-field">
            <span className="set-label">Nytt lösenord</span>
            <input
              className="set-input"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              disabled={savingPw}
              autoComplete="new-password"
            />
          </label>

          <label className="set-field">
            <span className="set-label">Bekräfta nytt lösenord</span>
            <input
              className="set-input"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              disabled={savingPw}
              autoComplete="new-password"
            />
          </label>

          {pwMsg && <p className={`set-msg set-msg--${pwMsg.kind}`}>{pwMsg.text}</p>}

          <div className="set-row">
            <button
              type="submit"
              className="set-btn set-btn--primary"
              disabled={savingPw || !currentPw || !newPw || !confirmPw}
            >
              {savingPw ? "Sparar…" : "Byt lösenord"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}

const css = `
  .set-card {
    background: #fff;
    border: 1px solid rgba(28,27,25,0.1);
    border-radius: 8px;
    padding: 1.5rem 1.75rem;
    margin-bottom: 1.5rem;
  }

  .set-card-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.4rem;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 0.5rem;
  }

  .set-card-meta {
    font-size: 13px;
    color: rgba(28,27,25,0.6);
    margin-bottom: 1.4rem;
    line-height: 1.45;
  }

  .set-card-meta strong {
    color: #1C1B19;
    font-weight: 600;
  }

  .set-card-meta a {
    color: #1C1B19;
    text-decoration: underline;
  }

  .set-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .set-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .set-label {
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(28,27,25,0.6);
    font-weight: 600;
  }

  .set-input {
    font-family: 'Barlow', sans-serif;
    font-size: 14px;
    padding: 0.6rem 0.8rem;
    background: #fff;
    border: 1.5px solid rgba(28,27,25,0.15);
    border-radius: 4px;
    color: #1C1B19;
    outline: none;
    transition: border-color 0.12s;
  }

  .set-input:focus { border-color: #1C1B19; }
  .set-input:disabled { background: #f6f3ee; cursor: not-allowed; }

  .set-row {
    display: flex;
    gap: 0.6rem;
    margin-top: 0.25rem;
  }

  .set-btn {
    font-family: 'Barlow', sans-serif;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.04em;
    padding: 0.6rem 1.2rem;
    border-radius: 4px;
    border: 0;
    cursor: pointer;
    transition: background 0.12s, opacity 0.12s;
  }

  .set-btn--primary {
    background: #1C1B19;
    color: #EDF8FB;
  }
  .set-btn--primary:hover:not(:disabled) { background: #2a2926; }
  .set-btn:disabled { opacity: 0.5; cursor: default; }

  .set-msg {
    font-size: 13px;
    padding: 0.55rem 0.75rem;
    border-radius: 4px;
  }
  .set-msg--ok {
    background: rgba(40,120,60,0.1);
    color: #2d6034;
    border: 1px solid rgba(40,120,60,0.25);
  }
  .set-msg--err {
    background: #fff3f3;
    color: #b03030;
    border: 1px solid #f4caca;
  }
`;
