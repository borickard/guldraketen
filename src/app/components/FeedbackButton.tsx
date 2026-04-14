"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

export default function FeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Hide on admin pages
  if (pathname.startsWith("/admin")) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, message, page: window.location.pathname }),
    });
    setSubmitting(false);
    setDone(true);
    setEmail("");
    setMessage("");
    setTimeout(() => { setDone(false); setOpen(false); }, 3000);
  }

  return (
    <>
      <style>{css}</style>
      <div className="fb-root">
        {open && (
          <div className="fb-popup">
            <button className="fb-close" onClick={() => setOpen(false)} aria-label="Stäng">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="1" y1="1" x2="13" y2="13" />
                <line x1="13" y1="1" x2="1" y2="13" />
              </svg>
            </button>
            {done ? (
              <p className="fb-thanks">Tack för din feedback! ❤️</p>
            ) : (
              <form onSubmit={handleSubmit} className="fb-form">
                <p className="fb-desc">
                  Berätta vad du tycker om sajten! Saknar du något? Är det något som inte fungerar? Feedback = ❤️
                </p>
                <input
                  className="fb-input"
                  type="email"
                  placeholder="Din e-post (valfritt)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
                <textarea
                  className="fb-textarea"
                  placeholder="Skriv din feedback…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={4}
                />
                <button
                  className="fb-submit"
                  type="submit"
                  disabled={submitting || !message.trim()}
                >
                  {submitting ? "Skickar…" : "Skicka feedback"}
                </button>
              </form>
            )}
          </div>
        )}
        <button
          className={`fb-trigger${open ? " fb-trigger--open" : ""}`}
          onClick={() => setOpen((v) => !v)}
          aria-label="Ge feedback"
        >
          {open ? (
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="1" y1="1" x2="13" y2="13" />
              <line x1="13" y1="1" x2="1" y2="13" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          )}
        </button>
      </div>
    </>
  );
}

const css = `
  .fb-root {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    z-index: 200;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.75rem;
    font-family: 'Barlow', sans-serif;
  }

  .fb-popup {
    position: relative;
    background: #fff;
    border: 1.5px solid rgba(28,27,25,0.12);
    border-radius: 14px;
    box-shadow: 0 8px 32px rgba(28,27,25,0.14);
    padding: 1.25rem 1.25rem 1rem;
    width: 300px;
  }

  .fb-close {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    background: none;
    border: none;
    cursor: pointer;
    color: #aaa;
    padding: 2px;
    display: flex;
    align-items: center;
    transition: color 0.12s;
  }
  .fb-close:hover { color: #1C1B19; }

  .fb-desc {
    font-size: 13px;
    line-height: 1.5;
    color: #444;
    margin-bottom: 0.85rem;
    padding-right: 1rem;
  }

  .fb-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .fb-input,
  .fb-textarea {
    font-family: 'Barlow', sans-serif;
    font-size: 13px;
    color: #1C1B19;
    background: #f7f6f4;
    border: 1px solid rgba(28,27,25,0.14);
    border-radius: 7px;
    padding: 0.55rem 0.75rem;
    outline: none;
    resize: none;
    transition: border-color 0.12s;
  }
  .fb-input:focus,
  .fb-textarea:focus { border-color: rgba(28,27,25,0.4); }
  .fb-input::placeholder,
  .fb-textarea::placeholder { color: #bbb; }

  .fb-submit {
    font-family: 'Barlow', sans-serif;
    font-size: 13px;
    font-weight: 600;
    background: #1C1B19;
    color: #EDF8FB;
    border: none;
    border-radius: 7px;
    padding: 0.6rem 1rem;
    cursor: pointer;
    transition: opacity 0.12s;
    margin-top: 0.25rem;
  }
  .fb-submit:disabled { opacity: 0.45; cursor: default; }
  .fb-submit:not(:disabled):hover { opacity: 0.85; }

  .fb-thanks {
    font-size: 14px;
    color: #1C1B19;
    text-align: center;
    padding: 0.5rem 0 0.25rem;
  }

  .fb-trigger {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: #1C1B19;
    color: #EDF8FB;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 16px rgba(28,27,25,0.25);
    transition: background 0.12s, transform 0.12s;
  }
  .fb-trigger:hover { background: #333; transform: scale(1.05); }
  .fb-trigger--open { background: #555; }
`;
