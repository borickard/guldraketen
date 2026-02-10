"use client";

import { useState } from "react";
import Image from "next/image";

type Platform = "tiktok" | "instagram" | "linkedin";

export default function HomePage() {
  const [platform, setPlatform] = useState<Platform>("tiktok");
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
        body: JSON.stringify({ platform, handle, email }),
      });

      const text = await res.text(); // läs alltid som text först
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        // inte JSON (t.ex. 404 HTML)
      }

      if (!res.ok || !json?.ok) {
        setError(json?.error || `API-fel (${res.status}): ${text.slice(0, 120)}`);
        return;
      }

      setDone(true);
    } catch {
      setError("Något gick fel. Försök igen.");
    } finally {
      setSubmitting(false);
    }
}

  return (
    <main
      style={{
        maxWidth: 920,
        margin: "0 auto",
        padding: "40px 16px",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <header style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 42, margin: "0 0 10px 0", letterSpacing: -0.5 }}>Guldraketen</h1>
        <p style={{ fontSize: 18, margin: 0, lineHeight: 1.55, opacity: 0.9 }}>
          Snart lanseras Guldraketen, som lyfter och prisar framstående engagerande innehåll.
          <br />
          Nominera ditt konto om du vill vara med.
        </p>
      </header>

      {!done ? (
        <section
          style={{
            border: "1px solid #e9e9e9",
            borderRadius: 18,
            padding: 22,
            boxShadow: "0 1px 0 rgba(0,0,0,0.02)",
          }}
        >
          <h2 style={{ fontSize: 22, margin: "0 0 14px 0" }}>Nominera ditt konto</h2>

          <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 14 }}>Plattform</span>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Platform)}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #ddd",
                  background: "white",
                }}
              >
                <option value="tiktok">TikTok</option>
                <option value="instagram">Instagram</option>
                <option value="linkedin">LinkedIn</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 14 }}>Användarnamn</span>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@dittkonto"
                autoComplete="off"
                inputMode="text"
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #ddd",
                }}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 14 }}>Jobbmail</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="namn@foretag.se"
                autoComplete="email"
                inputMode="email"
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #ddd",
                }}
              />
            </label>

            <div style={{ fontSize: 12.5, opacity: 0.85, lineHeight: 1.55 }}>
              <strong>Integritet</strong>: När du nominerar sparar vi plattform, handle och jobbmail för att hantera
              nomineringen och kontakta dig vid behov. Rättslig grund är berättigat intresse. Vi sparar uppgifterna så
              länge Guldraketen-projektet pågår. Du kan när som helst invända och be oss radera dina uppgifter genom att
              maila <strong>info@guldraketen.se</strong>.
            </div>

            {error && (
              <div style={{ color: "crimson", fontSize: 14, marginTop: 4 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                border: "none",
                background: "black",
                color: "white",
                cursor: submitting ? "not-allowed" : "pointer",
                fontSize: 16,
                fontWeight: 600,
                marginTop: 4,
              }}
            >
              {submitting ? "Skickar..." : "Skicka nominering"}
            </button>
          </form>
        </section>
      ) : (
        <section
          style={{
            border: "1px solid #e9e9e9",
            borderRadius: 18,
            padding: 22,
            boxShadow: "0 1px 0 rgba(0,0,0,0.02)",
          }}
        >
          <h2 style={{ fontSize: 22, margin: "0 0 8px 0" }}>Tack!</h2>
          <p style={{ marginTop: 0, lineHeight: 1.55, opacity: 0.9 }}>
            Vi har tagit emot din nominering. Följ gärna Guldraketen här (länkar uppdateras snart):
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginTop: 12 }}>
            <SocialIcon label="TikTok" href="#" src="/icons/tiktok.png" />
            <SocialIcon label="Instagram" href="#" src="/icons/instagram.png" />
            <SocialIcon label="LinkedIn" href="#" src="/icons/linkedin.png" />
          </div>

          <button
            onClick={() => {
              setDone(false);
              setHandle("");
              setEmail("");
              setPlatform("tiktok");
              setError(null);
            }}
            style={{
              marginTop: 18,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Nominera ett till konto
          </button>
        </section>
      )}

      <footer style={{ marginTop: 30, fontSize: 12.5, opacity: 0.7 }}>
        © {new Date().getFullYear()} Guldraketen
      </footer>
    </main>
  );
}

function SocialIcon({ label, href, src }: { label: string; href: string; src: string }) {
  return (
    <a
      href={href}
      aria-label={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 14,
        border: "1px solid #e5e5e5",
        textDecoration: "none",
        color: "black",
        background: "white",
      }}
    >
      <Image src={src} alt="" width={22} height={22} />
      <span style={{ fontSize: 14 }}>{label}</span>
    </a>
  );
}