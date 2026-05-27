"use client";

import { useState } from "react";

interface Props {
  category: string;
}

type Status =
  | { state: "idle" }
  | { state: "submitting" }
  | { state: "ok"; message: string }
  | { state: "error"; message: string };

export default function SuggestForm({ category }: Props) {
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [motivation, setMotivation] = useState("");
  const [status, setStatus] = useState<Status>({ state: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status.state === "submitting") return;
    setStatus({ state: "submitting" });

    try {
      const res = await fetch("/api/category-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle,
          display_name: displayName,
          category,
          email,
          motivation,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStatus({ state: "error", message: data.error ?? "Något gick fel." });
        return;
      }
      setStatus({
        state: "ok",
        message: data.message ?? "Tack! Förslaget är skickat.",
      });
      setHandle("");
      setDisplayName("");
      setEmail("");
      setMotivation("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Något gick fel.";
      setStatus({ state: "error", message });
    }
  }

  const disabled = status.state === "submitting";

  return (
    <form className="sg-form" onSubmit={onSubmit}>
      <h2 className="sg-title">Föreslå ett konto till {category}</h2>
      <p className="sg-lead">
        Saknas något företag eller organisation som passar i denna kategori?
        Skicka ett förslag så tar vi en titt.
      </p>

      <div className="sg-row">
        <label className="sg-field">
          <span className="sg-label">TikTok-användarnamn</span>
          <input
            type="text"
            className="sg-input"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="t.ex. @lidl_sverige"
            required
            disabled={disabled}
          />
        </label>
        <label className="sg-field">
          <span className="sg-label">Företag eller organisation</span>
          <input
            type="text"
            className="sg-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="t.ex. Lidl Sverige"
            required
            disabled={disabled}
          />
        </label>
      </div>

      <label className="sg-field">
        <span className="sg-label">E-post (valfritt)</span>
        <input
          type="email"
          className="sg-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="namn@exempel.se"
          disabled={disabled}
        />
      </label>

      <label className="sg-field">
        <span className="sg-label">Motivering (valfritt)</span>
        <textarea
          className="sg-input sg-textarea"
          value={motivation}
          onChange={(e) => setMotivation(e.target.value)}
          placeholder="Varför passar kontot i denna kategori?"
          rows={3}
          disabled={disabled}
        />
      </label>

      {status.state === "error" && <p className="sg-error">{status.message}</p>}
      {status.state === "ok" && <p className="sg-ok">{status.message}</p>}

      <button type="submit" className="sg-submit" disabled={disabled}>
        {disabled ? "Skickar…" : "Skicka förslag"}
      </button>

      <style>{css}</style>
    </form>
  );
}

const css = `
  .sg-form {
    background: #E2DDD7;
    border: 1px solid rgba(28,27,25,0.1);
    border-radius: 4px;
    padding: 1.8rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 720px;
  }

  .sg-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.1;
  }

  .sg-lead {
    font-size: 13px;
    color: rgba(28,27,25,0.7);
    margin-top: -0.35rem;
  }

  .sg-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  @media (max-width: 520px) {
    .sg-row { grid-template-columns: 1fr; }
  }

  .sg-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .sg-label {
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(28,27,25,0.55);
  }

  .sg-input {
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

  .sg-input:focus { border-color: #1C1B19; }

  .sg-textarea {
    resize: vertical;
    min-height: 4.5rem;
    font-family: 'Barlow', sans-serif;
  }

  .sg-submit {
    align-self: flex-start;
    background: #1C1B19;
    color: #EDF8FB;
    border: 0;
    padding: 0.7rem 1.4rem;
    font-family: 'Barlow', sans-serif;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.04em;
    cursor: pointer;
    border-radius: 4px;
    transition: opacity 0.12s;
  }

  .sg-submit:disabled { opacity: 0.5; cursor: not-allowed; }
  .sg-submit:hover:not(:disabled) { background: #2a2926; }

  .sg-error {
    background: #fff3f3;
    border: 1px solid #f4caca;
    color: #a02020;
    padding: 0.55rem 0.8rem;
    font-size: 13px;
    border-radius: 4px;
  }

  .sg-ok {
    background: #e8f5e9;
    border: 1px solid #b4d4b7;
    color: #2d6034;
    padding: 0.55rem 0.8rem;
    font-size: 13px;
    border-radius: 4px;
  }
`;
