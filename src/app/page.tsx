"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawVideo {
  id: string;
  handle: string;
  video_url: string;
  published_at: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
  thumbnail_url: string | null;
  caption: string | null;
  last_updated: string;
  accounts:
  | { followers: number; display_name?: string | null }
  | { followers: number; display_name?: string | null }[]
  | null;
}

interface AccountRow {
  handle: string;
  displayName: string;
  followers: number;
  bestVideo: RawVideo;
  bestEngagement: number;
  videoCount: number;
  videos: RawVideo[];
}

interface HofScore {
  handle: string;
  displayName: string;
  totalPoints: number;
  gold: number;
  silver: number;
  bronze: number;
}

interface Benchmark {
  count: number;
  average: number;
  median: number;
  p75: number;
  p90: number;
  period: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAccount(v: RawVideo) {
  const acct = Array.isArray(v.accounts) ? v.accounts[0] : v.accounts;
  return acct ?? { followers: 0, display_name: null };
}

function displayName(v: RawVideo): string {
  const acct = getAccount(v);
  return acct.display_name || `@${v.handle}`;
}

type CalcDetected =
  | { type: "video"; videoId: string; handle: string | null }
  | { type: "short"; url: string };

function detectCalcInput(raw: string): CalcDetected | null {
  const s = raw.trim();
  // Short links — resolve server-side via kalkylator
  if (/^https?:\/\/(vm|vt)\.tiktok\.com\/\w/.test(s)) return { type: "short", url: s };
  if (/^https?:\/\/(?:www\.)?tiktok\.com\/t\/\w/.test(s)) return { type: "short", url: s };
  // Standard video URL
  const vid = s.match(/\/video\/(\d+)/)?.[1];
  if (vid) return { type: "video", videoId: vid, handle: s.match(/\/@([^/?#\s]+)/)?.[1] ?? null };
  return null;
}

function fmt(n: number): string {
  if (n >= 1_000_000)
    return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return Math.round(n / 1_000) + "K";
  return String(n);
}

function fmtWeek(w: string): string {
  const m = w.match(/(\d{4})-W(\d{2})/);
  if (!m) return w;
  return `Vecka ${parseInt(m[2])}, ${m[1]}`;
}

function fmtWeekShort(w: string): string {
  const m = w.match(/(\d{4})-W(\d{2})/);
  if (!m) return w;
  return `Vecka ${parseInt(m[2])}`;
}

function computePercentile(er: number, bench: Benchmark): number {
  if (er >= bench.p90) return 90 + Math.min(9, ((er - bench.p90) / bench.p90) * 20);
  if (er >= bench.p75) return 75 + ((er - bench.p75) / (bench.p90 - bench.p75)) * 15;
  if (er >= bench.median) return 50 + ((er - bench.median) / (bench.p75 - bench.median)) * 25;
  return Math.max(1, (er / bench.median) * 50);
}

function groupByAccount(videos: RawVideo[]): AccountRow[] {
  const map = new Map<string, RawVideo[]>();
  for (const v of videos) {
    const list = map.get(v.handle) ?? [];
    list.push(v);
    map.set(v.handle, list);
  }
  const rows: AccountRow[] = [];
  for (const [handle, vids] of map) {
    const acct = getAccount(vids[0]);
    const qualifying = vids.filter((v) => (v.views ?? 0) >= 10_000);
    if (qualifying.length === 0) continue;
    const sorted = [...qualifying].sort(
      (a, b) => (b.engagement_rate ?? 0) - (a.engagement_rate ?? 0)
    );
    const bestVideo = sorted[0];
    rows.push({
      handle,
      displayName: acct.display_name || `@${handle}`,
      followers: acct.followers ?? 0,
      bestVideo,
      bestEngagement: bestVideo.engagement_rate ?? 0,
      videoCount: vids.length,
      videos: sorted,
    });
  }
  return rows.sort((a, b) => b.bestEngagement - a.bestEngagement);
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────


function TrendUp() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2E8B55" strokeWidth="2.5" strokeLinecap="round">
      <path d="M18 15l-6-6-6 6" />
    </svg>
  );
}

function TrendDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9B3A2A" strokeWidth="2.5" strokeLinecap="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function MedalDot({ color }: { color: string }) {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill={color} style={{ flexShrink: 0 }}>
      <circle cx="4" cy="4" r="4" />
    </svg>
  );
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg: "#EDF8FB",
  dark: "#07253A",
  gold: "#C8962A",
  silver: "#8A9299",
  bronze: "#96614A",
  accent: "#FE2C55",
  cardBg: "rgba(237,248,251,0.06)",
  cardBorder: "rgba(237,248,251,0.10)",
  line: "rgba(237,248,251,0.07)",
  muted: "rgba(7,37,58,0.52)",
  lightText: "rgba(237,248,251,0.92)",
  lightMuted: "rgba(237,248,251,0.55)",
  lightStat: "rgba(237,248,251,0.48)",
};

const RANK_COLORS = [C.gold, C.silver, C.bronze];

function rankColor(i: number) {
  return RANK_COLORS[i] ?? "#07253A";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function VideoThumb({ src, alt, fallback }: { src: string | null; alt: string; fallback: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <span className="gr-thumb-placeholder">{fallback}</span>;
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="120px"
      style={{ objectFit: "cover" }}
      unoptimized
      onError={() => setFailed(true)}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Topplista state
  const [weeks, setWeeks] = useState<string[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [videos, setVideos] = useState<RawVideo[]>([]);
  const [prevVideos, setPrevVideos] = useState<RawVideo[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [weekOpen, setWeekOpen] = useState(false);
  const wkRef = useRef<HTMLDivElement>(null);

  // Site-wide state
  const [siteStats, setSiteStats] = useState<{ video_count: number; account_count: number } | null>(null);
  const [hofScores, setHofScores] = useState<HofScore[]>([]);

  // ── Inline calculator state ──────────────────────────────────────────────────
  type CalcMode = "idle" | "video-loading" | "video-ready" | "video-not-found" | "video-error";
  const [calcUrl, setCalcUrl] = useState("");
  const [calcUrlError, setCalcUrlError] = useState(false);
  const [calcMode, setCalcMode] = useState<CalcMode>("idle");
  const [calcVideoId, setCalcVideoId] = useState<string | null>(null);
  const [calcHandle, setCalcHandle] = useState<string | null>(null);
  const [calcStats, setCalcStats] = useState<{ views: number; likes: number; comments: number; shares: number } | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [calcThumb, setCalcThumb] = useState<string | null>(null);
  const [calcLightbox, setCalcLightbox] = useState(false);
  const [calcCopied, setCalcCopied] = useState(false);
  const [calcBench, setCalcBench] = useState<Benchmark | null>(null);
  const [wLikes, setWLikes] = useState(1);
  const [wComments, setWComments] = useState(5);
  const [wShares, setWShares] = useState(10);
  const [betaEmail, setBetaEmail] = useState("");
  const [betaSubmitted, setBetaSubmitted] = useState(false);
  const [betaLoading, setBetaLoading] = useState(false);
  const [betaError, setBetaError] = useState<string | null>(null);
  const calcPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const calcStartedRef = useRef(false);

  // Karusell-tooltip
  const [showTooltip, setShowTooltip] = useState(false);

  // Close week picker on outside click
  useEffect(() => {
    if (!weekOpen) return;
    function handleClick(e: MouseEvent) {
      if (wkRef.current && !wkRef.current.contains(e.target as Node)) {
        setWeekOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [weekOpen]);

  // Fetch stats + HoF scores on mount
  useEffect(() => {
    fetch("/api/stats").then((r) => r.json()).then(setSiteStats).catch(() => {});
    fetch("/api/topplistan").then((r) => r.json()).then(setHofScores).catch(() => {});
  }, []);


  // Fetch available weeks
  useEffect(() => {
    fetch("/api/weeks")
      .then((r) => r.json())
      .then((ws: string[]) => {
        setWeeks(ws);
        const urlWeek = searchParams.get("week");
        if (urlWeek && ws.includes(urlWeek)) {
          setSelectedWeek(urlWeek);
        } else if (ws.length > 0) {
          setSelectedWeek(ws[0]);
        }
      });
  }, []);

  // Fetch current + previous week videos
  useEffect(() => {
    if (!selectedWeek) return;
    setLoading(true);
    setExpanded(null);

    const fetchCurrent = fetch(`/api/videos?week=${selectedWeek}`).then((r) => r.json());

    const weekIdx = weeks.indexOf(selectedWeek);
    const prevWeek = weekIdx + 1 < weeks.length ? weeks[weekIdx + 1] : null;
    const fetchPrev = prevWeek
      ? fetch(`/api/videos?week=${prevWeek}`).then((r) => r.json())
      : Promise.resolve([]);

    Promise.all([fetchCurrent, fetchPrev]).then(([curr, prev]) => {
      setVideos(curr);
      setPrevVideos(prev);
      setLoading(false);
    });
  }, [selectedWeek, weeks]);

  const accounts = useMemo(() => groupByAccount(videos), [videos]);
  const prevAccounts = useMemo(() => groupByAccount(prevVideos), [prevVideos]);

  const dataFreshnessLabel = useMemo(() => {
    if (!videos.length) return null;
    const maxUpdated = videos.reduce((max, v) =>
      v.last_updated > max ? v.last_updated : max, videos[0].last_updated);
    const days = Math.round((Date.now() - new Date(maxUpdated).getTime()) / (24 * 60 * 60 * 1000));
    if (days === 0) return "Uppdaterad idag";
    if (days === 1) return "Uppdaterad igår";
    return `Uppdaterad ${days} dagar sedan`;
  }, [videos]);

  const carouselVideos = useMemo(() => {
    return videos
      .filter((v) => v.thumbnail_url)
      .sort((a, b) => (b.engagement_rate ?? 0) - (a.engagement_rate ?? 0))
      .slice(0, 20);
  }, [videos]);

  const [carouselRow1, carouselRow2] = useMemo(() => {
    if (carouselVideos.length < 2) return [carouselVideos, carouselVideos];
    const mid = Math.ceil(carouselVideos.length / 2);
    return [carouselVideos.slice(0, mid), carouselVideos.slice(mid)];
  }, [carouselVideos]);

  // Map handle -> rank index for previous week
  const prevRankMap = useMemo(() => {
    const m = new Map<string, number>();
    prevAccounts.forEach((a, i) => m.set(a.handle, i));
    return m;
  }, [prevAccounts]);

  const toggle = useCallback((handle: string) => {
    setExpanded((e) => (e === handle ? null : handle));
  }, []);

  const RANK_SLUGS = ["guld", "silver", "brons"];
  const [copiedRank, setCopiedRank] = useState<number | null>(null);

  function handleShareCard(e: React.MouseEvent, rank: number) {
    e.stopPropagation();
    const slug = RANK_SLUGS[rank];
    const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/${selectedWeek}/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedRank(rank);
    setTimeout(() => setCopiedRank(null), 2000);
  }


  // Fetch benchmark on mount
  useEffect(() => {
    fetch("/api/benchmark").then((r) => r.json()).then(setCalcBench).catch(() => null);
    return () => { if (calcPollRef.current) clearInterval(calcPollRef.current); };
  }, []);

  // Fetch thumbnail when result is ready
  useEffect(() => {
    if (calcMode !== "video-ready" || !calcVideoId) { setCalcThumb(null); return; }
    const url = calcHandle
      ? `https://www.tiktok.com/@${calcHandle}/video/${calcVideoId}`
      : `https://www.tiktok.com/video/${calcVideoId}`;
    fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`)
      .then((r) => r.json()).then((d) => setCalcThumb(d.thumbnail_url ?? null)).catch(() => null);
  }, [calcMode, calcVideoId, calcHandle]);

  // Update URL with ?v= for shareability
  useEffect(() => {
    if (calcMode === "video-ready" && calcVideoId) {
      const p = new URLSearchParams({ v: calcVideoId });
      if (calcHandle) p.set("h", calcHandle);
      window.history.replaceState(null, "", `/?${p}`);
    }
  }, [calcMode, calcVideoId, calcHandle]);

  const startCalcFetch = useCallback(async (id: string, handle: string | null) => {
    if (calcPollRef.current) clearInterval(calcPollRef.current);
    setCalcMode("video-loading");
    setCalcVideoId(id);
    setCalcHandle(handle);
    setCalcStats(null);
    setCalcError(null);
    if (!handle) {
      setCalcMode("video-error");
      setCalcError("Kunde inte läsa ut handle ur länken. Kontrollera formatet tiktok.com/@konto/video/...");
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
      if (!res.ok) { setCalcMode("video-error"); setCalcError((data.error as string) ?? `Serverfel (${res.status})`); return; }
      if (data.source === "db") {
        setCalcStats({ views: data.views as number, likes: data.likes as number, comments: data.comments as number, shares: data.shares as number });
        setCalcMode("video-ready");
        return;
      }
      const { runId } = data;
      let ms = 0;
      calcPollRef.current = setInterval(async () => {
        ms += 3000;
        if (ms >= 120_000) { clearInterval(calcPollRef.current!); setCalcMode("video-error"); setCalcError("Tidsgränsen överskreds. Prova igen lite senare."); return; }
        try {
          const r = await fetch(`/api/fetch-video/result?runId=${runId}&videoId=${id}&handle=${encodeURIComponent(handle)}`);
          const d = await r.json();
          if (d.status === "ready") { clearInterval(calcPollRef.current!); setCalcStats({ views: d.views, likes: d.likes, comments: d.comments, shares: d.shares }); setCalcMode("video-ready"); }
          else if (d.status === "not-found") { clearInterval(calcPollRef.current!); setCalcMode("video-not-found"); }
          else if (d.status === "error") { clearInterval(calcPollRef.current!); setCalcMode("video-error"); setCalcError("Hämtningen misslyckades."); }
        } catch { clearInterval(calcPollRef.current!); setCalcMode("video-error"); setCalcError("Nätverksfel."); }
      }, 3000);
    } catch { setCalcMode("video-error"); setCalcError("Kunde inte kontakta servern."); }
  }, []);

  const resolveAndCalcFetch = useCallback(async (shortUrl: string) => {
    setCalcMode("video-loading");
    setCalcStats(null);
    setCalcError(null);
    try {
      const res = await fetch("/api/resolve-tiktok-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: shortUrl }) });
      const data = await res.json();
      if (!res.ok || !data.videoId) { setCalcMode("video-error"); setCalcError(data.error ?? "Kunde inte lösa upp länken."); return; }
      startCalcFetch(data.videoId, data.handle);
    } catch { setCalcMode("video-error"); setCalcError("Kunde inte kontakta servern."); }
  }, [startCalcFetch]);

  // Auto-fetch from ?v= URL param on mount
  useEffect(() => {
    if (calcStartedRef.current) return;
    const v = searchParams.get("v");
    const h = searchParams.get("h");
    if (!v) return;
    calcStartedRef.current = true;
    const url = h ? `https://www.tiktok.com/@${h}/video/${v}` : `https://www.tiktok.com/video/${v}`;
    setCalcUrl(url);
    startCalcFetch(v, h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const calcEr = useMemo(() => {
    if (!calcStats || calcStats.views <= 0) return null;
    return ((calcStats.likes * wLikes + calcStats.comments * wComments + calcStats.shares * wShares) / calcStats.views) * 100;
  }, [calcStats, wLikes, wComments, wShares]);

  const calcBenchPct = calcBench && calcBench.count > 0 && calcEr !== null
    ? Math.round(computePercentile(calcEr, calcBench))
    : null;

  const weightsChanged = wLikes !== 1 || wComments !== 5 || wShares !== 10;

  function handleCalcSubmit() {
    const detected = detectCalcInput(calcUrl);
    if (!detected) { setCalcUrlError(true); return; }
    setCalcUrlError(false);
    if (detected.type === "short") resolveAndCalcFetch(detected.url);
    else startCalcFetch(detected.videoId, detected.handle);
  }

  async function handleBetaSubmit() {
    const email = betaEmail.trim();
    if (!email || !/\S+@\S+\.\S+/.test(email)) { setBetaError("Ange en giltig e-postadress."); return; }
    setBetaLoading(true);
    setBetaError(null);
    try {
      const videoUrl = calcVideoId && calcHandle ? `https://www.tiktok.com/@${calcHandle}/video/${calcVideoId}` : null;
      const res = await fetch("/api/beta-signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, videoUrl }) });
      const data = await res.json();
      if (!res.ok) setBetaError(data.error ?? "Något gick fel. Prova igen.");
      else setBetaSubmitted(true);
    } catch { setBetaError("Kunde inte kontakta servern."); }
    finally { setBetaLoading(false); }
  }

  return (
    <div className="gr-root">

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="gr-hero-v2" id="hero">
        <div className="gr-hero-v2-inner">
          <h1 className="gr-hero-v2-h1">
            Vad{" "}
            <span style={{ color: C.accent }}>engagerar</span>
            <br />på TikTok?
          </h1>
          <div className="gr-hero-v2-manifest">
            <p>
              Många företag finns på sociala medier. Få skapar innehåll som faktiskt berör. De pratar, men ingen lyssnar — ett tomt kommentarsfält är inte sociala medier, det är en monolog utan publik.
            </p>
            <p>
              Sociala Raketer belyser de som gör sig förtjänta av engagemanget.
            </p>
          </div>
          <div className="gr-hero-v2-ctas">
            <a href="#topplistan" className="gr-hero-v2-btn-primary">
              Se veckans topplista
            </a>
            <a href="#kalkylator" className="gr-hero-v2-link">
              Testa din video
            </a>
          </div>
        </div>
      </section>

      {/* ── TOPPLISTA ──────────────────────────────────────────────────── */}
      <section id="topplistan" className="gr-list-section">

        {/* Header + week picker */}
        <div className="gr-list-section-hdr">
          <div className="gr-page-hdr">
            <h1 className="gr-page-title">Veckans raketer</h1>
            {selectedWeek && (() => {
              const weekIdx = weeks.indexOf(selectedWeek);
              const canBack = weekIdx + 1 < weeks.length;
              const canForward = weekIdx > 0;
              function goToWeek(w: string) {
                setSelectedWeek(w);
                router.replace(`?week=${w}`, { scroll: false });
                setWeekOpen(false);
              }
              return (
                <div className="gr-wk-controls" ref={wkRef}>
                  <button
                    className="gr-wk-arrow"
                    disabled={!canBack}
                    onClick={() => canBack && goToWeek(weeks[weekIdx + 1])}
                    aria-label="Föregående vecka"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                  <div className="gr-wk-inline">
                    <button
                      className={"gr-wk-pill" + (weekOpen ? " open" : "")}
                      onClick={() => setWeekOpen((v) => !v)}
                    >
                      {fmtWeekShort(selectedWeek)}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="gr-wk-chev">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    {weekOpen && (
                      <div className="gr-wk-drop">
                        {weeks.map((w) => (
                          <button
                            key={w}
                            className={"gr-wk-opt" + (w === selectedWeek ? " active" : "")}
                            onClick={() => goToWeek(w)}
                          >
                            {fmtWeek(w)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    className="gr-wk-arrow"
                    disabled={!canForward}
                    onClick={() => canForward && goToWeek(weeks[weekIdx - 1])}
                    aria-label="Nästa vecka"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
        {dataFreshnessLabel && (
          <p className="gr-toplist-freshness">{dataFreshnessLabel}</p>
        )}

        {/* Card grid */}
        <div className="gr-rk-grid">
          {loading
            ? [0, 1, 2].map((i) => (
                <div key={i} className="gr-rk-card">
                  <div className="gr-rk-card-inner gr-rk-skel" />
                </div>
              ))
            : accounts.slice(0, 3).map((acc, i) => {
                const isFlipped = expanded === acc.handle;
                const prevRank = prevRankMap.get(acc.handle);
                const delta = prevRank != null ? prevRank - i : null;
                const isNew = delta === null && prevVideos.length > 0;
                const thumb = acc.bestVideo.thumbnail_url;
                return (
                  <div
                    key={acc.handle}
                    className={`gr-rk-card${isFlipped ? " flipped" : ""}`}
                    onClick={() => toggle(acc.handle)}
                  >
                    <div className="gr-rk-card-inner">
                      {/* Front — dimmed thumbnail + rank/name/ER */}
                      <div className="gr-rk-card-front">
                        <div className="gr-rk-card-front-thumb">
                          {thumb && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={thumb} alt="" className="gr-rk-card-front-img" />
                          )}
                          <button
                            className="gr-rk-card-share"
                            onClick={(e) => handleShareCard(e, i)}
                            aria-label="Kopiera länk"
                          >
                            {copiedRank === i ? (
                              <span className="gr-rk-card-share-copied">Kopierad!</span>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                              </svg>
                            )}
                          </button>
                        </div>
                        <div className="gr-rk-card-front-info">
                          <div className="gr-rk-card-name">{acc.displayName}</div>
                          <div className="gr-rk-card-er" style={{ color: rankColor(i) }}>
                            {acc.bestEngagement.toFixed(2)}%
                          </div>
                          <div className="gr-rk-card-er-lbl">eng.rate</div>
                        </div>
                      </div>

                      {/* Back — metrics + button, no thumbnail */}
                      <div className="gr-rk-card-back">
                        <button
                          className="gr-rk-card-share gr-rk-card-share--back"
                          onClick={(e) => handleShareCard(e, i)}
                          aria-label="Kopiera länk"
                        >
                          {copiedRank === i ? (
                            <span className="gr-rk-card-share-copied">Kopierad!</span>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                            </svg>
                          )}
                        </button>
                        <div className="gr-rk-card-back-er-row">
                          <span className="gr-rk-card-back-rank" style={{ color: rankColor(i) }}>
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <div className="gr-rk-card-back-er" style={{ color: rankColor(i) }}>
                            {acc.bestEngagement.toFixed(2)}%
                            <span className="gr-rk-card-back-er-lbl"> eng.rate</span>
                          </div>
                        </div>
                        <div className="gr-rk-card-back-divider" />
                        <div className="gr-rk-card-back-metrics">
                          {[
                            { val: fmt(acc.bestVideo.views), lbl: "visningar" },
                            { val: fmt(acc.bestVideo.likes), lbl: "likes" },
                            { val: fmt(acc.bestVideo.comments), lbl: "kommentarer" },
                            { val: fmt(acc.bestVideo.shares), lbl: "delningar" },
                          ].map(({ val, lbl }) => (
                            <div key={lbl} className="gr-rk-card-back-metric">
                              <span className="gr-rk-card-back-metric-val">{val}</span>
                              <span className="gr-rk-card-back-metric-lbl">{lbl}</span>
                            </div>
                          ))}
                        </div>
                        {acc.followers > 0 && (
                          <div className="gr-rk-card-back-followers">
                            <span className="gr-rk-card-back-metric-val">{fmt(acc.followers)}</span>
                            <span className="gr-rk-card-back-metric-lbl"> följare</span>
                          </div>
                        )}
                        <div className="gr-rk-card-back-actions">
                          <a
                            href={acc.bestVideo.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="gr-rk-card-back-btn"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Visa videon
                          </a>
                          <a
                            href={`/konto/${acc.handle}`}
                            className="gr-rk-card-back-profile"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Visa profil
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
          }
        </div>
      </section>

      {/* ── KALKYLATOR ───────────────────────────────────────────────── */}
      <section className="gr-calc-section" id="kalkylator">
        <div className="gr-calc-section-inner">
          <h2 className="gr-calc-h2">Hur engagerande är ditt innehåll?</h2>
          <div className="gr-calc-desc">
            <p>
              Klistra in en länk till en TikTok-video så räknar vi ut engagemangsgraden och visar hur den står sig mot svenska företagsvideor.
            </p>
          </div>
          <div className="gr-calc-input-wrap">
            <input
              className={"gr-calc-section-input" + (calcUrlError ? " error" : "")}
              type="url"
              placeholder="tiktok.com/@konto/video/..."
              value={calcUrl}
              onChange={(e) => { setCalcUrl(e.target.value); setCalcUrlError(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleCalcSubmit(); }}
            />
            <button className="gr-calc-section-btn" onClick={handleCalcSubmit}>
              Analysera
            </button>
          </div>
          {calcUrlError && (
            <p className="gr-calc-section-err">
              Klistra in en TikTok-videolänk, t.ex. tiktok.com/@konto/video/12345.
            </p>
          )}

          {calcMode === "video-loading" && (
            <div className="gr-kalky-v2-loading" style={{ marginTop: 32 }}>
              <span className="gr-kalky-v2-spinner" />
              <span>Hämtar engagemang och analyserar</span>
            </div>
          )}

          {calcMode === "video-not-found" && (
            <div className="gr-kalky-v2-notice gr-kalky-v2-notice--warn" style={{ marginTop: 32 }}>
              Videon hittades inte i TikTok. Kontrollera att länken är korrekt.
            </div>
          )}

          {calcMode === "video-error" && calcError && (
            <div className="gr-kalky-v2-notice gr-kalky-v2-notice--error" style={{ marginTop: 32 }}>
              {calcError}
            </div>
          )}

          {calcMode === "video-ready" && calcStats && (
            <div className="gr-kalky-v2-result" style={{ marginTop: 32 }}>
              <div className="gr-kalky-v2-result-row">
                {calcThumb && (
                  <button className="gr-kalky-v2-thumb-btn" onClick={() => setCalcLightbox(true)} aria-label="Spela upp video">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={calcThumb} alt="" className="gr-kalky-v2-thumb" />
                    <div className="gr-kalky-v2-play">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
                    </div>
                  </button>
                )}
                <div className="gr-kalky-v2-er-block">
                  {calcEr !== null ? (
                    <>
                      <p className="gr-kalky-v2-er-lbl">Engagement rate</p>
                      <p className="gr-kalky-v2-er">{calcEr.toFixed(2)}<span className="gr-kalky-v2-er-unit">%</span></p>
                      {calcBenchPct !== null && (
                        <>
                          <p className="gr-kalky-v2-bench-line">
                            Bättre än <strong>{calcBenchPct >= 99 ? "99+" : calcBenchPct}%</strong> av svenska företagsvideor
                          </p>
                          <div className="gr-kalky-v2-bench-track">
                            <div className="gr-kalky-v2-bench-fill" style={{ width: `${Math.min(calcBenchPct, 99)}%` }} />
                            <div className="gr-kalky-v2-bench-dot" style={{ left: `${Math.min(calcBenchPct, 99)}%` }} />
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
                  { lbl: "Visningar", val: calcStats.views },
                  { lbl: "Likes", val: calcStats.likes },
                  { lbl: "Kommentarer", val: calcStats.comments },
                  { lbl: "Delningar", val: calcStats.shares },
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
                  <button className="gr-kalky-v2-reset" onClick={() => { setWLikes(1); setWComments(5); setWShares(10); }}>
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
                  onClick={() => { navigator.clipboard.writeText(window.location.href); setCalcCopied(true); setTimeout(() => setCalcCopied(false), 2000); }}
                >
                  {calcCopied ? "Kopierad!" : "Kopiera länk"}
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
                      <button className="gr-kalky-beta-btn" onClick={handleBetaSubmit} disabled={betaLoading}>
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
      </section>

      {calcLightbox && calcVideoId && (
        <div className="gr-kalky-lightbox" onClick={() => setCalcLightbox(false)}>
          <div className="gr-kalky-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <button className="gr-kalky-lightbox-close" onClick={() => setCalcLightbox(false)} aria-label="Stäng">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <iframe src={`https://www.tiktok.com/embed/v2/${calcVideoId}`} className="gr-kalky-lightbox-frame" allow="fullscreen" allowFullScreen />
          </div>
        </div>
      )}

      {/* ── KARUSELL ─────────────────────────────────────────────────── */}
      {carouselVideos.length > 0 && (
        <section className="gr-examples" id="exempel">
          <div className="gr-examples-hdr">
            <h2 className="gr-examples-title">Exempel från topplistan</h2>
            <div style={{ position: "relative" }}>
              <button
                className="gr-examples-info-btn"
                onClick={() => setShowTooltip((v) => !v)}
                onBlur={() => setTimeout(() => setShowTooltip(false), 150)}
                aria-label="Info om exemplen"
              >
                i
              </button>
              {showTooltip && (
                <div className="gr-examples-tooltip">
                  Videor med särskilt högt engagemang de senaste veckorna. Bakom varje thumbnail finns riktigt innehåll som faktiskt engagerade en publik.
                </div>
              )}
            </div>
          </div>
          <div className="gr-carousel-wrap">
            <div className="gr-carousel-row gr-carousel-row--fwd">
              {Array.from({length: 6}, () => carouselRow1).flat().map((v, i) => (
                <a key={i} href={v.video_url} target="_blank" rel="noopener noreferrer" className="gr-carousel-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.thumbnail_url!} alt="" className="gr-carousel-thumb" />
                  <div className="gr-carousel-info">
                    <span className="gr-carousel-name">{displayName(v)}</span>
                    <span className="gr-carousel-er">{Number(v.engagement_rate).toFixed(2)}%</span>
                  </div>
                </a>
              ))}
            </div>
            <div className="gr-carousel-row gr-carousel-row--rev">
              {Array.from({length: 6}, () => carouselRow2).flat().map((v, i) => (
                <a key={i} href={v.video_url} target="_blank" rel="noopener noreferrer" className="gr-carousel-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.thumbnail_url!} alt="" className="gr-carousel-thumb" />
                  <div className="gr-carousel-info">
                    <span className="gr-carousel-name">{displayName(v)}</span>
                    <span className="gr-carousel-er">{Number(v.engagement_rate).toFixed(2)}%</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── HALL OF FAME ─────────────────────────────────────────────── */}
      {hofScores.length > 0 && (
        <section className="gr-hof-inline" id="hall-of-fame">
          <div className="gr-hof-inline-inner">
            <div className="gr-hof-inline-hdr">
              <div>
                <h2 className="gr-hof-inline-h2">Hall of fame</h2>
                <p className="gr-hof-inline-sub">
                  Flest poäng genom tiderna · Guld 15p · Silver 10p · Brons 5p
                </p>
              </div>
              <a href="/hall-of-fame" className="gr-hof-inline-cta">
                Se alla
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
            </div>
            <ol className="gr-hof-inline-list">
              {hofScores.slice(0, 10).map((s, i) => (
                <li key={s.handle} className="gr-hof-inline-item">
                  <span className="gr-hof-inline-rank">{i + 1}</span>
                  <MedalDot color={[C.gold, C.silver, C.bronze][i] ?? "rgba(7,37,58,0.25)"} />
                  <span className="gr-hof-inline-name">{s.displayName || `@${s.handle}`}</span>
                  <span className="gr-hof-inline-pts">{s.totalPoints}p</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* ── OM ENGAGEMANG ────────────────────────────────────────────── */}
      <section className="gr-about-section" id="om-engagemang">
        <div className="gr-about-inner">
          <h2 className="gr-about-h2">Om engagemang</h2>
          <div className="gr-about-blocks">
            <div>
              <h3 className="gr-about-block-title">Inte alla reaktioner är lika värda</h3>
              <p className="gr-about-block-body">
                Alla interaktioner är inte likvärdiga. En delning kräver mer av tittaren än en like — och betyder mer. Vår formel premierar delningar högst, kommentarer i mitten och likes sist. Likes i all ära. Men när någon kommenterar har de stannat upp — något väckte en reaktion. Och när de delar? Då har du nått fram genom bruset.
              </p>
            </div>
            <div>
              <h3 className="gr-about-block-title">Svenska företag och organisationer</h3>
              <p className="gr-about-block-body">
                Sociala Raketer mäter svenska företag och organisationer som skapar innehåll som faktiskt berör. Inte privata kreatörer — utan de som använder sociala medier som en del av sitt kommunikationsarbete. Varje vecka utvärderas hundratals videor automatiskt.
              </p>
            </div>
            <div>
              <h3 className="gr-about-block-title">Hur står sig du?</h3>
              <p className="gr-about-block-body">
                Klistra in en video eller ett @handle så räknar vi ut engagemangsgraden — och visar hur du står dig mot de som rankats.
              </p>
              <a href="#kalkylator" className="gr-about-cta-link">
                Gå till kalkylatorn
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────── */}
      <footer className="gr-footer-v2">
        <div className="gr-footer-v2-inner">
          <div>
            <span className="gr-footer-v2-wordmark">Sociala Raketer</span>
            <p className="gr-footer-v2-tagline">
              Utvärderar engagemang på TikTok sedan 2026. Skapat av{" "}
              <a href="https://www.linkedin.com/in/rickardberggren/" target="_blank" rel="noopener noreferrer" className="gr-footer-v2-name">Rickard Berggren</a>.
            </p>
          </div>
          <div>
            <span className="gr-footer-v2-col-title">Navigering</span>
            <a href="#topplistan" className="gr-footer-v2-link">Topplistan</a>
            <a href="#kalkylator" className="gr-footer-v2-link">Kalkylator</a>
            <a href="#hall-of-fame" className="gr-footer-v2-link">Hall of Fame</a>
            <a href="#om-engagemang" className="gr-footer-v2-link">Om engagemang</a>
          </div>
          <div>
            <p className="gr-footer-v2-disclaimer">
              Vi är inte affilierade med TikTok eller ByteDance. Data hämtas publikt och uppdateras varje vecka.
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeInner />
    </Suspense>
  );
}
