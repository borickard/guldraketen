"use client";

import { useState } from "react";

export default function NomineraPage() {
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/nominate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "tiktok", handle, email }),
      });
      const text = await res.text();
      let json: { ok?: boolean; error?: string } | null = null;
      try { json = JSON.parse(text); } catch { /* noop */ }
      if (!res.ok || !json?.ok) {
        setError(json?.error || `Något gick fel (${res.status})`);
        return;
      }
      setDone(true);
    } catch {
      setError("Något gick fel. Försök igen.");
    } finally {
      setSubmitting(false);
    }
  }

  const linkedInText = encodeURIComponent(
    "Koll på vilka svenska företag som faktiskt når fram på TikTok? Sociala raketer rankar de mest engagerande kontona varje vecka — baserat på likes, kommentarer och delningar. Kolla in det här 👇"
  );
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent("https://guldraketen.vercel.app")}&summary=${linkedInText}`;

  return (
    <main className="gr-root gr-page">
      <div className="gr-page-content">
        <h1 className="gr-page-title">Nominera</h1>
        <p className="gr-page-lead">
          Känner du ett svenskt företag eller organisation som skapar engagerande innehåll på TikTok? Tipsa oss så tar vi en titt.
        </p>

        {!done ? (
          <div style={{ background: "var(--gr-card)", border: "1.5px solid var(--gr-line)", borderRadius: 18, padding: "24px" }}>
            <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", opacity: 0.5 }}>
                  TikTok-handle
                </span>
                <input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="@kontot"
                  autoComplete="off"
                  required
                  style={{ padding: "12px 14px", borderRadius: 12, border: "1.5px solid var(--gr-line)", background: "var(--gr-bg)", fontFamily: "'Barlow', sans-serif", fontSize: 15, color: "var(--gr-dark)", outline: "none" }}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", opacity: 0.5 }}>
                  Din e-post (valfri)
                </span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="namn@foretag.se"
                  autoComplete="email"
                  inputMode="email"
                  style={{ padding: "12px 14px", borderRadius: 12, border: "1.5px solid var(--gr-line)", background: "var(--gr-bg)", fontFamily: "'Barlow', sans-serif", fontSize: 15, color: "var(--gr-dark)", outline: "none" }}
                />
              </label>
              <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, lineHeight: 1.6, opacity: 0.5 }}>
                Vi sparar handle och eventuell e-post för att hantera nomineringen. Rättslig grund: berättigat intresse. Kontakta <strong>info@socialraketer.se</strong> för att begära radering.
              </div>
              {error && <div style={{ color: "crimson", fontFamily: "'Barlow', sans-serif", fontSize: 13 }}>{error}</div>}
              <button
                type="submit"
                disabled={submitting}
                style={{ padding: "14px", borderRadius: 14, border: "none", background: "var(--gr-dark)", color: "#EBE7E2", cursor: submitting ? "not-allowed" : "pointer", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, letterSpacing: ".04em", textTransform: "uppercase" }}
              >
                {submitting ? "Skickar..." : "Skicka nominering"}
              </button>
            </form>
          </div>
        ) : (
          <div style={{ background: "var(--gr-card)", border: "1.5px solid var(--gr-line)", borderRadius: 18, padding: "28px 24px" }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, marginBottom: 10, color: "var(--gr-dark)" }}>
              Tack!
            </div>
            <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 15, lineHeight: 1.65, opacity: 0.75, margin: "0 0 28px" }}>
              Vi har tagit emot din nominering och kollar in kontot.
            </p>

            <div style={{ borderTop: "1px solid var(--gr-line)", paddingTop: 24 }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, marginBottom: 8, color: "var(--gr-dark)" }}>
                Dela projektet på LinkedIn
              </div>
              <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, lineHeight: 1.6, opacity: 0.65, margin: "0 0 16px" }}>
                Hjälp oss nå fler — dela Sociala raketer med ditt nätverk.
              </p>
              <a
                href={linkedInUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "12px 18px", borderRadius: 12, background: "#0A66C2", color: "#fff", textDecoration: "none", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                Dela på LinkedIn
              </a>
            </div>

            <button
              onClick={() => { setDone(false); setHandle(""); setEmail(""); setError(null); }}
              style={{ marginTop: 20, padding: "10px 14px", borderRadius: 12, border: "1.5px solid var(--gr-line)", background: "transparent", cursor: "pointer", fontFamily: "'Barlow', sans-serif", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--gr-dark)", opacity: 0.6 }}
            >
              Nominera ett till
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
