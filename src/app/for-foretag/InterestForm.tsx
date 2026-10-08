"use client";

import { useState } from "react";

export default function InterestForm() {
  const [email, setEmail] = useState("");
  const [handle, setHandle] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const e = email.trim();
    if (!e || !/\S+@\S+\.\S+/.test(e)) {
      setError("Ange en giltig e-postadress.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/beta-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, handle: handle.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Något gick fel. Prova igen.");
      else setDone(true);
    } catch {
      setError("Kunde inte kontakta servern.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="ff-form ff-form--done">
        <p className="ff-done-title">Tack! Du står på listan. 🚀</p>
        <p className="ff-done-text">Vi hör av oss så snart vi öppnar upp för fler konton.</p>
      </div>
    );
  }

  return (
    <div className="ff-form">
      <div className="ff-fields">
        <input
          className="ff-input"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="din@email.se"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        />
        <input
          className="ff-input ff-input--handle"
          type="text"
          placeholder="@ert-tiktok (valfritt)"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        />
        <button className="ff-submit" onClick={submit} disabled={loading}>
          {loading ? "Skickar…" : "Anmäl intresse"}
        </button>
      </div>
      {error && <p className="ff-error">{error}</p>}
      <p className="ff-note">Inga förpliktelser — vi hör av oss när vi öppnar upp fler platser.</p>
    </div>
  );
}
