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

// ─── Constants ────────────────────────────────────────────────────────────────

const C = {
  bg: "#EBE7E2",
  dark: "#1C1B19",
  gold: "#C8962A",
  muted: "rgba(28,27,25,0.52)",
};

const DEFAULT_WEIGHTS = { wLikes: 1, wComments: 5, wShares: 10 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractVideoId(url: string): string | null {
  const m = url.match(/\/video\/(\d+)/);
  return m ? m[1] : null;
}

function extractHandle(url: string): string | null {
  const m = url.match(/\/@([^/?]+)\/video/);
  return m ? m[1] : null;
}

// ─── BenchmarkCallout component ──────────────────────────────────────────────

function computePercentile(er: number, bench: Benchmark): number {
  if (er >= bench.p90) return 90 + Math.min(9, ((er - bench.p90) / bench.p90) * 20);
  if (er >= bench.p75) return 75 + ((er - bench.p75) / (bench.p90 - bench.p75)) * 15;
  if (er >= bench.median) return 50 + ((er - bench.median) / (bench.p75 - bench.median)) * 25;
  return Math.max(1, (er / bench.median) * 50);
}

function BenchmarkBar({
  er,
  bench,
}: {
  er: number | null;
  bench: Benchmark;
}) {
  if (bench.count === 0) {
    return (
      <p className="gr-kalky-bench-nodata">
        Ingen jämförelsedata tillgänglig ännu.
      </p>
    );
  }

  const pct = er !== null ? computePercentile(er, bench) : null;
  const pctRounded = pct !== null ? Math.round(pct) : null;
  const trackPct = pct !== null ? Math.min(pct, 99) : null;

  return (
    <div className="gr-kalky-bench">
      <p className="gr-kalky-bench-period">
        {bench.period} · {bench.count} videor
      </p>

      {pctRounded !== null ? (
        <>
          <p className="gr-kalky-bench-headline">
            Bättre än{" "}
            <span className="gr-kalky-bench-pct">
              {pctRounded >= 99 ? "99+" : pctRounded}%
            </span>
            {" "}av svenska<br />företagsvideor
          </p>
          <div className="gr-kalky-bench-track">
            <div
              className="gr-kalky-bench-fill"
              style={{ width: `${trackPct}%` }}
            />
            <div
              className="gr-kalky-bench-dot"
              style={{ left: `${trackPct}%` }}
            />
          </div>
          <div className="gr-kalky-bench-track-labels">
            <span>0%</span>
            <span>Topp 25%</span>
            <span>Topp 10%</span>
          </div>
        </>
      ) : (
        <p className="gr-kalky-bench-empty">
          Fyll i statistik för att se hur din video jämförs.
        </p>
      )}

    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function KalkylatorPage() {
  const searchParams = useSearchParams();

  // URL + embed
  const [url, setUrl] = useState(() => {
    const v = searchParams.get("v");
    const h = searchParams.get("h");
    if (v && h) return `https://www.tiktok.com/@${h}/video/${v}`;
    if (v) return `https://www.tiktok.com/video/${v}`;
    return "";
  });
  const [videoId, setVideoId] = useState<string | null>(null);
  const autoFetchRef = useRef(!!searchParams.get("v"));
  const [urlError, setUrlError] = useState(false);

  // Stats
  const [views, setViews] = useState("");
  const [likes, setLikes] = useState("");
  const [comments, setComments] = useState("");
  const [shares, setShares] = useState("");

  // Fetch status
  type FetchStatus = "idle" | "loading" | "not-found" | "error";
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>("idle");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Thumbnail + lightbox
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Weights
  const [wLikes, setWLikes] = useState(1);
  const [wComments, setWComments] = useState(5);
  const [wShares, setWShares] = useState(10);

  // Benchmark
  const [bench, setBench] = useState<Benchmark | null>(null);
  const [benchError, setBenchError] = useState(false);
  const [benchLoading, setBenchLoading] = useState(true);

  // Fetch benchmark on mount
  useEffect(() => {
    fetch("/api/benchmark")
      .then((r) => r.json())
      .then((d: Benchmark) => {
        setBench(d);
        setBenchLoading(false);
      })
      .catch(() => {
        setBenchError(true);
        setBenchLoading(false);
      });
  }, []);

  // Fetch thumbnail via TikTok oEmbed when URL changes
  useEffect(() => {
    if (!videoId || !url) {
      setThumbnailUrl(null);
      setLightboxOpen(false);
      return;
    }
    setThumbnailUrl(null);
    setLightboxOpen(false);
    fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((d) => setThumbnailUrl(d.thumbnail_url ?? null))
      .catch(() => setThumbnailUrl(null));
  }, [videoId, url]);

  // Sync videoId → ?v= query param (no navigation, just history)
  useEffect(() => {
    const next = videoId ? `/kalkylator?v=${videoId}` : "/kalkylator";
    window.history.replaceState(null, "", next);
  }, [videoId]);

  // Parse URL — also reset fetch + lightbox state when URL changes
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setFetchStatus("idle");
    setFetchError(null);
    setLightboxOpen(false);

    if (!url.trim()) {
      setVideoId(null);
      setUrlError(false);
      return;
    }
    const id = extractVideoId(url);
    if (id) {
      setVideoId(id);
      setUrlError(false);
    } else {
      setVideoId(null);
      setUrlError(true);
    }
  }, [url]);

  // Computed ER
  const engagementRate = useMemo(() => {
    const v = parseFloat(views);
    if (!v || v <= 0) return null;
    const l = parseFloat(likes) || 0;
    const c = parseFloat(comments) || 0;
    const s = parseFloat(shares) || 0;
    return ((l * wLikes + c * wComments + s * wShares) / v) * 100;
  }, [views, likes, comments, shares, wLikes, wComments, wShares]);

  const weightsChanged =
    wLikes !== DEFAULT_WEIGHTS.wLikes ||
    wComments !== DEFAULT_WEIGHTS.wComments ||
    wShares !== DEFAULT_WEIGHTS.wShares;

  function populateStats(data: { views?: number | null; likes?: number | null; comments?: number | null; shares?: number | null }) {
    if (data.views != null) setViews(String(data.views));
    if (data.likes != null) setLikes(String(data.likes));
    if (data.comments != null) setComments(String(data.comments));
    if (data.shares != null) setShares(String(data.shares));
  }

  const handleFetchStats = useCallback(async function handleFetchStats() {
    if (!videoId) return;
    const handle = extractHandle(url);
    if (!handle) {
      setFetchStatus("error");
      setFetchError("Kunde inte läsa ut kontots handle från länken.");
      return;
    }

    setFetchStatus("loading");
    setFetchError(null);

    try {
      const startRes = await fetch("/api/fetch-video/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, handle }),
      });
      const startData = await startRes.json();

      if (!startRes.ok) {
        setFetchStatus("error");
        setFetchError(startData.error ?? "Okänt fel");
        return;
      }

      if (startData.source === "db") {
        populateStats(startData);
        setFetchStatus("idle");
        return;
      }

      // Poll Apify result
      const { runId } = startData;
      let elapsed = 0;

      pollRef.current = setInterval(async () => {
        elapsed += 3000;
        if (elapsed >= 120_000) {
          clearInterval(pollRef.current!);
          setFetchStatus("error");
          setFetchError("Tidsgränsen överskreds. Fyll i statistik manuellt.");
          return;
        }

        try {
          const res = await fetch(`/api/fetch-video/result?runId=${runId}&videoId=${videoId}&handle=${encodeURIComponent(handle)}`);
          const data = await res.json();

          if (data.status === "ready") {
            clearInterval(pollRef.current!);
            populateStats(data);
            setFetchStatus("idle");
          } else if (data.status === "not-found") {
            clearInterval(pollRef.current!);
            setFetchStatus("not-found");
          } else if (data.status === "error") {
            clearInterval(pollRef.current!);
            setFetchStatus("error");
            setFetchError("Apify-körningen misslyckades. Fyll i statistik manuellt.");
          }
          // "pending" → keep polling
        } catch {
          clearInterval(pollRef.current!);
          setFetchStatus("error");
          setFetchError("Nätverksfel vid hämtning.");
        }
      }, 3000);
    } catch {
      setFetchStatus("error");
      setFetchError("Kunde inte kontakta servern.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, url, fetchStatus]);

  // Auto-fetch when arriving from homepage with pre-filled video
  useEffect(() => {
    if (autoFetchRef.current && videoId && fetchStatus === "idle") {
      autoFetchRef.current = false;
      handleFetchStats();
    }
  }, [videoId, fetchStatus, handleFetchStats]);

  return (
    <div className="gr-root">
      <div className="gr-kalky-page">
        {/* Header */}
        <div className="gr-kalky-header">
          <h1 className="gr-kalky-title">Engagemangskalkylator</h1>
          <p className="gr-kalky-subtitle">
            Klistra in en TikTok-länk, fyll i statistik och se hur din video presterar — och hur den jämförs mot svenska företagskonton.
          </p>
        </div>

        {/* Two-column layout */}
        <div className="gr-kalky-layout">
          {/* ── Left: embed ── */}
          <div className="gr-kalky-left">
            <div>
              <label className="gr-kalky-label">TikTok-länk</label>
              <input
                type="url"
                className={"gr-kalky-input" + (urlError ? " error" : "")}
                placeholder="https://www.tiktok.com/@konto/video/1234567890"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && videoId && fetchStatus !== "loading") {
                    handleFetchStats();
                  }
                }}
              />
              {urlError && (
                <p className="gr-kalky-url-error">
                  Hittar ingen video-ID i länken. Kontrollera att länken innehåller /video/...
                </p>
              )}
            </div>

            {videoId && (
              <div className="gr-kalky-fetch-row">
                <button
                  className={"gr-kalky-fetch-btn" + (fetchStatus === "loading" ? " gr-kalky-fetch-btn--loading" : "")}
                  onClick={handleFetchStats}
                  disabled={fetchStatus === "loading"}
                >
                  {fetchStatus === "loading" ? (
                    <span className="gr-kalky-fetch-spinner" />
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  )}
                  {fetchStatus === "loading" ? "Hämtar..." : "Hämta statistik automatiskt"}
                </button>
                {fetchStatus === "not-found" && (
                  <p className="gr-kalky-fetch-msg gr-kalky-fetch-msg--warn">
                    Videon hittades inte. Fyll i statistik manuellt.
                  </p>
                )}
                {fetchStatus === "error" && fetchError && (
                  <p className="gr-kalky-fetch-msg gr-kalky-fetch-msg--error">
                    {fetchError}
                  </p>
                )}
              </div>
            )}

            <div className="gr-kalky-embed-wrap">
              {videoId ? (
                thumbnailUrl ? (
                  <button
                    className="gr-kalky-thumb-btn"
                    onClick={() => setLightboxOpen(true)}
                    aria-label="Spela upp video"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumbnailUrl} alt="" className="gr-kalky-thumb-img" />
                    <div className="gr-kalky-thumb-play">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </button>
                ) : (
                  <div className="gr-kalky-thumb-skeleton" />
                )
              ) : (
                <div className="gr-kalky-embed-placeholder">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round">
                    <rect x="3" y="3" width="18" height="18" rx="4" />
                    <path d="M10 8l6 4-6 4V8z" />
                  </svg>
                  <span>Klistra in en TikTok-länk för att se videon här</span>
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
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
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

            <div className="gr-kalky-notice">
              <strong>OBS:</strong> TikTok-statistik uppdateras i realtid. Siffror från igår kan skilja sig från vad du ser i appen idag.
            </div>
          </div>

          {/* ── Right: result + inputs + weights ── */}
          <div className="gr-kalky-right">
            {/* Result card */}
            <div className="gr-kalky-result">
              {fetchStatus === "loading" ? (
                <>
                  <p className="gr-kalky-result-label">Hämtar statistik...</p>
                  <div className="gr-kalky-result-spinner" />
                </>
              ) : engagementRate !== null ? (
                <>
                  <p className="gr-kalky-result-label">Engagement rate</p>
                  <p className="gr-kalky-result-er">
                    {engagementRate.toFixed(2)}
                    <span className="gr-kalky-result-pct">%</span>
                  </p>
                </>
              ) : (
                <p className="gr-kalky-result-empty">
                  Fyll i Visningar + minst ett engagemangsvärde för att beräkna.
                </p>
              )}

              <div className="gr-kalky-bench-wrap">
                {benchLoading ? (
                  <div className="gr-kalky-bench-skeleton" />
                ) : benchError ? (
                  <p className="gr-kalky-bench-nodata">
                    Jämförelsedata kunde inte laddas.
                  </p>
                ) : bench ? (
                  <BenchmarkBar
                    er={engagementRate}
                    bench={bench}
                  />
                ) : null}
              </div>
            </div>

            {/* Stats inputs */}
            <div className="gr-kalky-section">
              <p className="gr-kalky-section-label">Statistik från videon</p>
              <div className="gr-kalky-stat-grid">
                {[
                  { label: "Visningar", value: views, setter: setViews },
                  { label: "Likes", value: likes, setter: setLikes },
                  { label: "Kommentarer", value: comments, setter: setComments },
                  { label: "Delningar", value: shares, setter: setShares },
                ].map(({ label, value, setter }) => (
                  <div key={label} className="gr-kalky-stat-field">
                    <label className="gr-kalky-stat-label">{label}</label>
                    <input
                      type="number"
                      min="0"
                      className="gr-kalky-stat-input"
                      placeholder="0"
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Weights */}
            <div className="gr-kalky-section">
              <p className="gr-kalky-section-label">Formelns vikter</p>
              <div className="gr-kalky-weights-row">
                {[
                  { label: "Likes", value: wLikes, setter: setWLikes },
                  { label: "Kommentarer", value: wComments, setter: setWComments },
                  { label: "Delningar", value: wShares, setter: setWShares },
                ].map(({ label, value, setter }) => (
                  <div key={label} className="gr-kalky-weight-ctrl">
                    <span className="gr-kalky-weight-label">{label}</span>
                    <div className="gr-kalky-weight-stepper">
                      <button
                        className="gr-kalky-weight-btn"
                        onClick={() => setter(Math.max(0, value - 1))}
                        aria-label={`Minska ${label}`}
                      >
                        −
                      </button>
                      <span className="gr-kalky-weight-num">×{value}</span>
                      <button
                        className="gr-kalky-weight-btn"
                        onClick={() => setter(Math.min(20, value + 1))}
                        aria-label={`Öka ${label}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="gr-kalky-weight-footer">
                <p className="gr-kalky-formula-preview">
                  (likes×{wLikes} + kommentarer×{wComments} + delningar×{wShares}) ÷ visningar × 100
                </p>
                {weightsChanged && (
                  <button
                    className="gr-kalky-reset-btn"
                    onClick={() => {
                      setWLikes(DEFAULT_WEIGHTS.wLikes);
                      setWComments(DEFAULT_WEIGHTS.wComments);
                      setWShares(DEFAULT_WEIGHTS.wShares);
                    }}
                  >
                    Återställ standardvikter
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div className="gr-footer">
        <div className="gr-footer-heading">
          Vad är<br />
          <span style={{ color: C.gold }}>Engagemang?</span>
        </div>
        <p className="gr-footer-body">
          Likes i all ära. Men när någon kommenterar har de stannat upp — något väckte en reaktion. Och när de delar? Då har du nått fram genom bruset, rört något, och fått dem att säga: <em className="gr-footer-em">"det här måste du se."</em> Det är vår definition av engagemang.
        </p>
        <p className="gr-footer-credit">
          Sociala Raketer&nbsp;&middot;&nbsp;2026
        </p>
      </div>
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
