"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Benchmark {
  count: number;
  average: number;
  median: number;
  p75: number;
  p90: number;
  period: string;
}

type Mode = "idle" | "video-loading" | "video-ready" | "video-not-found" | "video-error";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Detected =
  | { type: "video"; videoId: string; handle: string | null }
  | { type: "short"; url: string };

function detectInput(raw: string): Detected | null {
  const s = raw.trim();
  // Short links must be resolved server-side
  if (/^https?:\/\/(vm|vt)\.tiktok\.com\/\w/.test(s)) return { type: "short", url: s };
  if (/^https?:\/\/(?:www\.)?tiktok\.com\/t\/\w/.test(s)) return { type: "short", url: s };
  // Standard video URL (handles all query-param variants)
  const vid = s.match(/\/video\/(\d+)/)?.[1];
  if (vid) return { type: "video", videoId: vid, handle: s.match(/\/@([^/?#\s]+)/)?.[1] ?? null };
  return null;
}

function computePercentile(er: number, bench: Benchmark): number {
  if (er >= bench.p90) return 90 + Math.min(9, ((er - bench.p90) / bench.p90) * 20);
  if (er >= bench.p75) return 75 + ((er - bench.p75) / (bench.p90 - bench.p75)) * 15;
  if (er >= bench.median) return 50 + ((er - bench.median) / (bench.p75 - bench.median)) * 25;
  return Math.max(1, (er / bench.median) * 50);
}

// ─── Main page ────────────────────────────────────────────────────────────────

function KalkylatorPage() {
  const searchParams = useSearchParams();

  const initialUrl = (() => {
    const urlParam = searchParams.get("url");
    if (urlParam) return urlParam;
    const v = searchParams.get("v");
    const h = searchParams.get("h");
    if (v && h) return `https://www.tiktok.com/@${h}/video/${v}`;
    if (v) return `https://www.tiktok.com/video/${v}`;
    return "";
  })();

  const [inputUrl, setInputUrl] = useState(initialUrl);
  const [inputError, setInputError] = useState(false);
  const [mode, setMode] = useState<Mode>("idle");

  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoHandle, setVideoHandle] = useState<string | null>(null);
  const [videoStats, setVideoStats] = useState<{
    views: number; likes: number; comments: number; shares: number;
  } | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const [copied, setCopied] = useState(false);

  const [betaEmail, setBetaEmail] = useState("");
  const [betaSubmitted, setBetaSubmitted] = useState(false);
  const [betaLoading, setBetaLoading] = useState(false);
  const [betaError, setBetaError] = useState<string | null>(null);

  const [wLikes, setWLikes] = useState(1);
  const [wComments, setWComments] = useState(5);
  const [wShares, setWShares] = useState(10);
  const [bench, setBench] = useState<Benchmark | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    fetch("/api/benchmark").then((r) => r.json()).then(setBench).catch(() => null);
  }, []);

  useEffect(() => {
    if (mode !== "video-ready" || !videoId) { setThumbnailUrl(null); return; }
    const url = videoHandle
      ? `https://www.tiktok.com/@${videoHandle}/video/${videoId}`
      : `https://www.tiktok.com/video/${videoId}`;
    fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((d) => setThumbnailUrl(d.thumbnail_url ?? null))
      .catch(() => null);
  }, [mode, videoId, videoHandle]);

  useEffect(() => {
    if (mode === "video-ready" && videoId) {
      const p = new URLSearchParams({ v: videoId });
      if (videoHandle) p.set("h", videoHandle);
      window.history.replaceState(null, "", `/kalkylator?${p}`);
    }
  }, [mode, videoId, videoHandle]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const startVideoFetch = useCallback(async (id: string, handle: string | null) => {
    if (pollRef.current) clearInterval(pollRef.current);
    setMode("video-loading");
    setVideoId(id);
    setVideoHandle(handle);
    setVideoStats(null);
    setVideoError(null);

    if (!handle) {
      setMode("video-error");
      setVideoError("Kunde inte läsa ut handle ur länken. Kontrollera att länken är i formatet tiktok.com/@konto/video/...");
      return;
    }

    try {
      const res = await fetch("/api/fetch-video/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: id, handle }),
      });
      let data: Record<string, unknown> = {};
      try { data = await res.json(); } catch { /* non-json */ }

      if (!res.ok) {
        setMode("video-error");
        setVideoError((data.error as string) ?? `Serverfel (${res.status})`);
        return;
      }

      if (data.source === "db") {
        setVideoStats({ views: data.views as number, likes: data.likes as number, comments: data.comments as number, shares: data.shares as number });
        setMode("video-ready");
        return;
      }

      const { runId } = data;
      let ms = 0;
      pollRef.current = setInterval(async () => {
        ms += 3000;
        if (ms >= 120_000) {
          clearInterval(pollRef.current!);
          setMode("video-error");
          setVideoError("Tidsgränsen överskreds. Prova igen lite senare.");
          return;
        }
        try {
          const r = await fetch(`/api/fetch-video/result?runId=${runId}&videoId=${id}&handle=${encodeURIComponent(handle)}`);
          const d = await r.json();
          if (d.status === "ready") {
            clearInterval(pollRef.current!);
            setVideoStats({ views: d.views, likes: d.likes, comments: d.comments, shares: d.shares });
            setMode("video-ready");
          } else if (d.status === "not-found") {
            clearInterval(pollRef.current!);
            setMode("video-not-found");
          } else if (d.status === "error") {
            clearInterval(pollRef.current!);
            setMode("video-error");
            setVideoError("Hämtningen misslyckades.");
          }
        } catch {
          clearInterval(pollRef.current!);
          setMode("video-error");
          setVideoError("Nätverksfel.");
        }
      }, 3000);
    } catch {
      setMode("video-error");
      setVideoError("Kunde inte kontakta servern.");
    }
  }, []);

  const resolveAndFetch = useCallback(async (shortUrl: string) => {
    setMode("video-loading");
    setVideoStats(null);
    setVideoError(null);
    try {
      const res = await fetch("/api/resolve-tiktok-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: shortUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data.videoId) {
        setMode("video-error");
        setVideoError(data.error ?? "Kunde inte lösa upp länken.");
        return;
      }
      startVideoFetch(data.videoId, data.handle);
    } catch {
      setMode("video-error");
      setVideoError("Kunde inte kontakta servern.");
    }
  }, [startVideoFetch]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (initialUrl) {
      const detected = detectInput(initialUrl);
      if (!detected) return;
      if (detected.type === "short") resolveAndFetch(detected.url);
      else startVideoFetch(detected.videoId, detected.handle);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit() {
    const trimmed = inputUrl.trim();
    if (!trimmed) return;
    const detected = detectInput(trimmed);
    if (!detected) { setInputError(true); return; }
    setInputError(false);
    if (detected.type === "short") resolveAndFetch(detected.url);
    else startVideoFetch(detected.videoId, detected.handle);
  }

  const er = useMemo(() => {
    if (!videoStats || videoStats.views <= 0) return null;
    return ((videoStats.likes * wLikes + videoStats.comments * wComments + videoStats.shares * wShares) / videoStats.views) * 100;
  }, [videoStats, wLikes, wComments, wShares]);

  const benchPct = bench && bench.count > 0 && er !== null
    ? Math.round(computePercentile(er, bench))
    : null;

  const weightsChanged = wLikes !== 1 || wComments !== 5 || wShares !== 10;

  async function handleBetaSubmit() {
    const email = betaEmail.trim();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setBetaError("Ange en giltig e-postadress.");
      return;
    }
    setBetaLoading(true);
    setBetaError(null);
    try {
      const videoUrl = videoId && videoHandle
        ? `https://www.tiktok.com/@${videoHandle}/video/${videoId}`
        : null;
      const res = await fetch("/api/beta-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, videoUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBetaError(data.error ?? "Något gick fel. Prova igen.");
      } else {
        setBetaSubmitted(true);
      }
    } catch {
      setBetaError("Kunde inte kontakta servern.");
    } finally {
      setBetaLoading(false);
    }
  }

  return (
    <div className="gr-root">
      <div className="gr-kalky-v2">

        <div className="gr-kalky-v2-head">
          <h1 className="gr-kalky-v2-title">Engagemangskalkylator</h1>
          <p className="gr-kalky-v2-sub">
            Klistra in en länk till en TikTok-video så räknar vi ut engagemangsgraden och visar hur den står sig mot svenska företagsvideor.
          </p>
        </div>

        <div className="gr-kalky-v2-input-wrap">
          <div className="gr-kalky-v2-input-row">
            <input
              type="url"
              className={"gr-kalky-v2-input" + (inputError ? " error" : "")}
              placeholder="tiktok.com/@konto/video/..."
              value={inputUrl}
              onChange={(e) => { setInputUrl(e.target.value); setInputError(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            />
            <button className="gr-kalky-v2-btn" onClick={handleSubmit}>
              Analysera
            </button>
          </div>
          {inputError && (
            <p className="gr-kalky-v2-input-err">
              Klistra in en TikTok-videolänk, t.ex. tiktok.com/@konto/video/12345.
            </p>
          )}
        </div>

        {mode === "video-loading" && (
          <div className="gr-kalky-v2-loading">
            <span className="gr-kalky-v2-spinner" />
            <span>Hämtar engagemang och analyserar</span>
          </div>
        )}

        {mode === "video-not-found" && (
          <div className="gr-kalky-v2-notice gr-kalky-v2-notice--warn">
            Videon hittades inte i TikTok. Kontrollera att länken är korrekt.
          </div>
        )}

        {mode === "video-error" && videoError && (
          <div className="gr-kalky-v2-notice gr-kalky-v2-notice--error">
            {videoError}
          </div>
        )}

        {mode === "video-ready" && videoStats && (
          <div className="gr-kalky-v2-result">
            <div className="gr-kalky-v2-result-row">
              {thumbnailUrl && (
                <button
                  className="gr-kalky-v2-thumb-btn"
                  onClick={() => setLightboxOpen(true)}
                  aria-label="Spela upp video"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbnailUrl} alt="" className="gr-kalky-v2-thumb" />
                  <div className="gr-kalky-v2-play">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </button>
              )}
              <div className="gr-kalky-v2-er-block">
                {er !== null ? (
                  <>
                    <p className="gr-kalky-v2-er-lbl">Engagement rate</p>
                    <p className="gr-kalky-v2-er">
                      {er.toFixed(2)}<span className="gr-kalky-v2-er-unit">%</span>
                    </p>
                    {benchPct !== null && (
                      <>
                        <p className="gr-kalky-v2-bench-line">
                          Bättre än <strong>{benchPct >= 99 ? "99+" : benchPct}%</strong> av svenska företagsvideor
                        </p>
                        <div className="gr-kalky-v2-bench-track">
                          <div className="gr-kalky-v2-bench-fill" style={{ width: `${Math.min(benchPct, 99)}%` }} />
                          <div className="gr-kalky-v2-bench-dot" style={{ left: `${Math.min(benchPct, 99)}%` }} />
                        </div>
                        <div className="gr-kalky-v2-bench-labels">
                          <span>0%</span><span>Topp 25%</span><span>Topp 10%</span>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <p className="gr-kalky-v2-er-empty">Ingen ER (saknar visningar)</p>
                )}
              </div>
            </div>

            <div className="gr-kalky-v2-stats">
              {[
                { lbl: "Visningar", val: videoStats.views },
                { lbl: "Likes", val: videoStats.likes },
                { lbl: "Kommentarer", val: videoStats.comments },
                { lbl: "Delningar", val: videoStats.shares },
              ].map(({ lbl, val }) => (
                <div key={lbl} className="gr-kalky-v2-stat">
                  <span className="gr-kalky-v2-stat-val">{val.toLocaleString("sv-SE")}</span>
                  <span className="gr-kalky-v2-stat-lbl">{lbl}</span>
                </div>
              ))}
            </div>

            <details className="gr-kalky-v2-weights">
              <summary>Justera formelns vikter</summary>
              <div className="gr-kalky-v2-weights-row">
                {([
                  { label: "Likes", value: wLikes, setter: setWLikes },
                  { label: "Kommentarer", value: wComments, setter: setWComments },
                  { label: "Delningar", value: wShares, setter: setWShares },
                ] as { label: string; value: number; setter: (v: number) => void }[]).map(({ label, value, setter }) => (
                  <div key={label} className="gr-kalky-v2-weight">
                    <span>{label}</span>
                    <div className="gr-kalky-v2-stepper">
                      <button onClick={() => setter(Math.max(0, value - 1))}>−</button>
                      <span>×{value}</span>
                      <button onClick={() => setter(Math.min(20, value + 1))}>+</button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="gr-kalky-v2-formula">
                (likes×{wLikes} + kommentarer×{wComments} + delningar×{wShares}) ÷ visningar × 100
              </p>
              {weightsChanged && (
                <button
                  className="gr-kalky-v2-reset"
                  onClick={() => { setWLikes(1); setWComments(5); setWShares(10); }}
                >
                  Återställ standardvikter
                </button>
              )}
            </details>

            <div className="gr-kalky-v2-share">
              <span className="gr-kalky-v2-share-url">
                {typeof window !== "undefined" ? window.location.href : ""}
              </span>
              <button
                className="gr-kalky-v2-copy-btn"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? "Kopierad!" : "Kopiera länk"}
              </button>
            </div>

            <div className="gr-kalky-beta">
              <p className="gr-kalky-beta-desc">
                Vill du testa hela din profil? Fyll i din mail så återkommer vi när vi öppnar upp för beta-testning.
              </p>
              {betaSubmitted ? (
                <p className="gr-kalky-beta-success">Tack! Vi hör av oss när beta öppnar.</p>
              ) : (
                <>
                  <div className="gr-kalky-beta-row">
                    <input
                      type="email"
                      className="gr-kalky-beta-email"
                      placeholder="din@email.se"
                      value={betaEmail}
                      onChange={(e) => { setBetaEmail(e.target.value); setBetaError(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") handleBetaSubmit(); }}
                    />
                    <button
                      className="gr-kalky-beta-btn"
                      onClick={handleBetaSubmit}
                      disabled={betaLoading}
                    >
                      {betaLoading ? "..." : "Anmäl"}
                    </button>
                  </div>
                  {betaError && <p className="gr-kalky-beta-err">{betaError}</p>}
                </>
              )}
            </div>
          </div>
        )}

      </div>

      {lightboxOpen && videoId && (
        <div className="gr-kalky-lightbox" onClick={() => setLightboxOpen(false)}>
          <div className="gr-kalky-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <button
              className="gr-kalky-lightbox-close"
              onClick={() => setLightboxOpen(false)}
              aria-label="Stäng"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <iframe
              src={`https://www.tiktok.com/embed/v2/${videoId}`}
              className="gr-kalky-lightbox-frame"
              allow="fullscreen"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <KalkylatorPage />
    </Suspense>
  );
}
