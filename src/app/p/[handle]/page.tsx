"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";

interface ProfileVideo {
  videoId: string | null;
  videoUrl: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
  caption: string;
  thumbnailUrl: string | null;
}

type Status = "starting" | "loading" | "ready" | "error";

export default function ProfilePage() {
  const params = useParams();
  const handle = typeof params.handle === "string" ? params.handle : "";

  const [status, setStatus] = useState<Status>("starting");
  const [elapsed, setElapsed] = useState(0);
  const [videos, setVideos] = useState<ProfileVideo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || !handle) return;
    startedRef.current = true;

    async function start() {
      try {
        const res = await fetch("/api/fetch-profile/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handle }),
        });
        const data = await res.json();

        if (!res.ok) {
          setStatus("error");
          setError(data.error ?? "Okänt fel");
          return;
        }

        const { runId } = data;
        setStatus("loading");
        timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);

        let ms = 0;
        pollRef.current = setInterval(async () => {
          ms += 5000;
          if (ms >= 300_000) {
            clearInterval(pollRef.current!);
            clearInterval(timerRef.current!);
            setStatus("error");
            setError("Tidsgränsen överskreds. Prova att ladda om sidan.");
            return;
          }
          try {
            const r = await fetch(`/api/fetch-profile/result?runId=${runId}`);
            const d = await r.json();
            if (d.status === "ready") {
              clearInterval(pollRef.current!);
              clearInterval(timerRef.current!);
              setVideos(d.videos);
              setStatus("ready");
            } else if (d.status === "error") {
              clearInterval(pollRef.current!);
              clearInterval(timerRef.current!);
              setStatus("error");
              setError("Hämtningen misslyckades. Prova att ladda om sidan.");
            }
          } catch { /* keep polling */ }
        }, 5000);
      } catch {
        setStatus("error");
        setError("Kunde inte kontakta servern.");
      }
    }

    start();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle]);

  return (
    <div className="gr-root">
      <div className="gr-kalky-v2">

        {/* Header */}
        <div className="gr-kalky-v2-head">
          <p className="gr-kalky-v2-back-link">
            <a href="/#kalkylator">← Kalkylatorn</a>
          </p>
          <h1 className="gr-kalky-v2-title">@{handle}</h1>
          <p className="gr-kalky-v2-sub">Profilanalys</p>
        </div>

        {/* Starting */}
        {status === "starting" && (
          <div className="gr-kalky-v2-loading">
            <span className="gr-kalky-v2-spinner" />
            <span>Startar analys...</span>
          </div>
        )}

        {/* Loading */}
        {status === "loading" && (
          <div className="gr-kalky-v2-profile">
            <div className="gr-kalky-v2-profile-top">
              <span className="gr-kalky-v2-spinner" />
              <div>
                <p className="gr-kalky-v2-profile-title">Hämtar data för @{handle}</p>
                <p className="gr-kalky-v2-profile-eta">
                  {elapsed}s — tar vanligtvis 1–3 minuter
                </p>
              </div>
            </div>

            <div className="gr-kalky-v2-profile-notify">
              <label className="gr-kalky-v2-profile-notify-lbl">
                Fyll i din jobbmail — vi hör av oss så fort det är klart.
              </label>
              <div className="gr-kalky-v2-email-row">
                <input
                  type="email"
                  className="gr-kalky-v2-email"
                  placeholder="din@jobbmail.se"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button className="gr-kalky-v2-email-btn" disabled>
                  Notifiera mig
                </button>
              </div>
              <p className="gr-kalky-v2-email-note">E-postnotifieringar är inte aktiva ännu.</p>
            </div>
          </div>
        )}

        {/* Ready */}
        {status === "ready" && videos && (
          <div className="gr-kalky-v2-profile-result">
            <h2 className="gr-kalky-v2-profile-result-h">
              {videos.length} videor analyserade
            </h2>
            <p className="gr-kalky-v2-profile-result-meta">
              Rankade efter engagement rate
            </p>
            <div className="gr-kalky-v2-pvlist">
              {videos.slice(0, 10).map((v, i) => (
                <a
                  key={v.videoId ?? i}
                  href={v.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gr-kalky-v2-pv"
                >
                  {v.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.thumbnailUrl} alt="" className="gr-kalky-v2-pv-thumb" />
                  )}
                  <div className="gr-kalky-v2-pv-body">
                    <p className="gr-kalky-v2-pv-er">{v.engagementRate.toFixed(2)}% ER</p>
                    <p className="gr-kalky-v2-pv-views">{v.views.toLocaleString("sv-SE")} visningar</p>
                    {v.caption && <p className="gr-kalky-v2-pv-cap">{v.caption}</p>}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {status === "error" && error && (
          <div className="gr-kalky-v2-notice gr-kalky-v2-notice--error">
            {error}
          </div>
        )}

      </div>
    </div>
  );
}
