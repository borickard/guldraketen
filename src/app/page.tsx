"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, ThumbsUp, MessageCircle, Share2 } from "lucide-react";

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
  const [loading, setLoading] = useState(true);

  // Site-wide state
  const [siteStats, setSiteStats] = useState<{ video_count: number; account_count: number } | null>(null);

  // ── Inline calculator state ──────────────────────────────────────────────────
  type CalcMode = "idle" | "video-loading" | "video-ready" | "video-not-found" | "video-error";
  const [calcUrl, setCalcUrl] = useState("");
  const [calcUrlError, setCalcUrlError] = useState(false);
  const [calcMode, setCalcMode] = useState<CalcMode>("idle");
  const [calcVideoId, setCalcVideoId] = useState<string | null>(null);
  const [calcHandle, setCalcHandle] = useState<string | null>(null);
  const [calcStats, setCalcStats] = useState<{ views: number; likes: number; comments: number; shares: number } | null>(null);
  const [calcLastUpdated, setCalcLastUpdated] = useState<string | null>(null);
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
  // ── FAQ accordion + inline forms ────────────────────────────────────────────
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  type FormState = { handle: string; email: string; status: "idle" | "loading" | "ok" | "err"; msg: string };
  const FORM_IDLE: FormState = { handle: "", email: "", status: "idle", msg: "" };
  const [nomForm, setNomForm] = useState<FormState>(FORM_IDLE);
  const [faqBetaForm, setFaqBetaForm] = useState<FormState>(FORM_IDLE);

  async function submitNomination(e: React.FormEvent) {
    e.preventDefault();
    setNomForm((p) => ({ ...p, status: "loading" }));
    try {
      const res = await fetch("/api/nominate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "tiktok", handle: nomForm.handle, email: nomForm.email }),
      });
      const data = await res.json();
      if (data.ok) setNomForm((p) => ({ ...p, status: "ok", msg: data.message || "Tack! Vi lägger till kontot inom kort." }));
      else setNomForm((p) => ({ ...p, status: "err", msg: data.error || "Något gick fel, försök igen." }));
    } catch {
      setNomForm((p) => ({ ...p, status: "err", msg: "Nätverksfel, försök igen." }));
    }
  }

  async function submitFaqBeta(e: React.FormEvent) {
    e.preventDefault();
    setFaqBetaForm((p) => ({ ...p, status: "loading" }));
    try {
      const res = await fetch("/api/beta-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: faqBetaForm.handle, email: faqBetaForm.email }),
      });
      const data = await res.json();
      if (data.ok) setFaqBetaForm((p) => ({ ...p, status: "ok", msg: data.message || "Tack! Vi hör av oss." }));
      else setFaqBetaForm((p) => ({ ...p, status: "err", msg: data.error || "Något gick fel, försök igen." }));
    } catch {
      setFaqBetaForm((p) => ({ ...p, status: "err", msg: "Nätverksfel, försök igen." }));
    }
  }

  const calcPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const calcStartedRef = useRef(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const videoCacheRef = useRef<Map<string, RawVideo[]>>(new Map());
  const dragState = useRef({ dragging: false, startX: 0, scrollStart: 0 });

  // Karusell-tooltip


  // Fetch stats on mount
  useEffect(() => {
    fetch("/api/stats").then((r) => r.json()).then(setSiteStats).catch(() => {});
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

  // Fetch current + adjacent weeks, with cache so navigation is instant
  useEffect(() => {
    if (!selectedWeek || weeks.length === 0) return;

    const cache = videoCacheRef.current;
    const weekIdx = weeks.indexOf(selectedWeek);
    const prevWeek = weekIdx + 1 < weeks.length ? weeks[weekIdx + 1] : null;
    const nextWeek = weekIdx > 0 ? weeks[weekIdx - 1] : null;

    // Show cached data immediately
    const cachedCurrent = cache.get(selectedWeek);
    const cachedPrev = prevWeek ? cache.get(prevWeek) : [];
    if (cachedCurrent !== undefined) {
      setVideos(cachedCurrent);
      setPrevVideos(cachedPrev ?? []);
      setLoading(false);
    } else {
      setLoading(true);
      if (cachedPrev !== undefined) setPrevVideos(cachedPrev);
    }

    // Fetch anything missing (current + prev for trend + next for preload)
    const missing = [
      cachedCurrent === undefined ? selectedWeek : null,
      prevWeek && cachedPrev === undefined ? prevWeek : null,
      nextWeek && !cache.has(nextWeek) ? nextWeek : null,
    ].filter((w): w is string => w !== null);

    if (missing.length === 0) return;
    let active = true;

    Promise.all(
      missing.map((w) => fetch(`/api/videos?week=${w}`).then((r) => r.json()).then((data) => [w, data] as const))
    ).then((results) => {
      if (!active) return;
      results.forEach(([w, data]) => cache.set(w, data));
      const curr = cache.get(selectedWeek);
      if (curr) { setVideos(curr); setLoading(false); }
      if (prevWeek) { const prev = cache.get(prevWeek); if (prev) setPrevVideos(prev); }
    });

    return () => { active = false; };
  }, [selectedWeek, weeks]);

  const accounts = useMemo(() => groupByAccount(videos), [videos]);
  const prevAccounts = useMemo(() => groupByAccount(prevVideos), [prevVideos]);

  const carouselVideos = useMemo(() => {
    const filtered = videos.filter((v) => v.thumbnail_url && (v.views ?? 0) >= 10000).slice(0, 20);
    for (let i = filtered.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
    }
    return filtered;
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
    setCalcLastUpdated(null);
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
      if (!res.ok) {
        if (res.status === 429) {
          setCalcMode("video-error");
          setCalcError("Kalkylatorn har nått dagens gräns på 50 analyser. Kom tillbaka imorgon och prova igen!");
        } else {
          setCalcMode("video-error");
          setCalcError((data.error as string) ?? `Serverfel (${res.status})`);
        }
        return;
      }
      if (data.source === "db") {
        setCalcStats({ views: data.views as number, likes: data.likes as number, comments: data.comments as number, shares: data.shares as number });
        setCalcLastUpdated((data.lastUpdated as string) ?? null);
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
    // Scroll to calculator section
    setTimeout(() => {
      document.getElementById("kalkylator")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
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

  const CAROUSEL_DURATION = 60; // seconds for one full set

  function getCarouselCurrentX(row: HTMLElement): number {
    const mat = new DOMMatrix(getComputedStyle(row).transform);
    return mat.m41;
  }

  function onCarouselPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const row = carouselRef.current;
    if (!row) return;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    const currentX = getCarouselCurrentX(row);
    row.style.animationPlayState = "paused";
    row.style.transform = `translateX(${currentX}px)`;
    row.style.animation = "none";
    dragState.current = { dragging: true, startX: e.clientX, scrollStart: currentX };
    (e.currentTarget as HTMLDivElement).style.cursor = "grabbing";
  }

  function onCarouselPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragState.current.dragging || !carouselRef.current) return;
    e.preventDefault();
    const dx = e.clientX - dragState.current.startX;
    const newX = dragState.current.scrollStart + dx;
    carouselRef.current.style.transform = `translateX(${newX}px)`;
  }

  function onCarouselPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const row = carouselRef.current;
    if (!dragState.current.dragging || !row) return;
    const dx = Math.abs(e.clientX - dragState.current.startX);
    dragState.current.dragging = false;
    (e.currentTarget as HTMLDivElement).style.cursor = "grab";

    // Treat as a tap — navigate to the card under the pointer
    if (dx < 5) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const card = el?.closest<HTMLAnchorElement>("a.gr-top-carousel-card");
      if (card?.href) {
        // On mobile, use same-tab navigation so iOS/Android Universal Links
        // can intercept and open the TikTok app. Desktop gets a new tab.
        if (/Mobi|Android/i.test(navigator.userAgent)) {
          window.location.href = card.href;
        } else {
          window.open(card.href, "_blank", "noopener,noreferrer");
        }
      }
    }

    // Resume CSS animation from current drag position
    const currentX = parseFloat(row.style.transform.replace("translateX(", "").replace("px)", "")) || 0;
    // oneSet = scrollWidth of one copy; animation moves from 0 to -oneSet
    const oneSet = row.scrollWidth / 3;
    // Normalise position into [0, -oneSet] range
    const normalized = ((currentX % -oneSet) - oneSet) % -oneSet;
    const progress = Math.abs(normalized) / oneSet; // 0..1
    const delay = -(progress * CAROUSEL_DURATION);
    row.style.transform = "";
    row.style.animation = `gr-top-scroll ${CAROUSEL_DURATION}s ${delay}s linear infinite`;
  }

  return (
    <div className="gr-root">

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="gr-hero-v2" id="hero">
        <div className="gr-hero-v2-inner">
          <h1 className="gr-hero-v2-h1">
            <span style={{ whiteSpace: "nowrap" }}>Vad <span style={{ color: C.accent }}>engagerar</span></span>
            <br />på TikTok?
          </h1>
          <div className="gr-hero-v2-manifest">
            <p>
              Många företag finns på sociala medier. Få skapar innehåll som faktiskt berör. Siffrorna avslöjar vem.
            </p>
          </div>
          <div className="gr-hero-v2-ctas">
            <a href="#topplistan" className="gr-hero-v2-btn-primary">
              Veckans topplista
            </a>
            <a href="#kalkylator" className="gr-hero-v2-link">
              Testa din video
            </a>
          </div>
        </div>
      </section>

      {/* ── SCROLL HINT ───────────────────────────────────────────────── */}
      <div className="gr-scroll-hint" aria-hidden="true">
        <a href="#topplistan" className="gr-scroll-hint-arrow">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </a>
      </div>

      {/* ── KARUSELL (strip above topplistan) ───────────────────────── */}
      <div
        className="gr-top-carousel"
        onPointerDown={!loading ? onCarouselPointerDown : undefined}
        onPointerMove={!loading ? onCarouselPointerMove : undefined}
        onPointerUp={!loading ? onCarouselPointerUp : undefined}
        onPointerCancel={!loading ? onCarouselPointerUp : undefined}
      >
        {loading ? (
          <div className="gr-top-carousel-inner gr-top-carousel-inner--skel">
            {Array.from({ length: 14 }, (_, i) => (
              <div key={i} className="gr-top-carousel-skel" />
            ))}
          </div>
        ) : carouselVideos.length > 0 ? (
          <div className="gr-top-carousel-inner" ref={carouselRef}>
            {Array.from({ length: 3 }, () => carouselVideos).flat().map((v, i) => (
              <a
                key={i}
                href={v.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="gr-top-carousel-card"
                draggable={false}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.thumbnail_url!} alt="" className="gr-top-carousel-thumb" draggable={false} />
                <div className="gr-top-carousel-info">
                  <span className="gr-top-carousel-name">{displayName(v)}</span>
                  <span className="gr-top-carousel-er">{Number(v.engagement_rate).toFixed(2)}%</span>
                </div>
              </a>
            ))}
          </div>
        ) : null}
      </div>

      {/* ── TOPPLISTA ──────────────────────────────────────────────────── */}
      <section id="topplistan" className="gr-list-section">

        {/* Header */}
        <div className="gr-list-section-hdr">
          <h1 className="gr-page-title">Veckans raketer</h1>
          {selectedWeek && (
            <p className="gr-week-subtitle">{fmtWeekShort(selectedWeek)}</p>
          )}
        </div>

        {/* Week nav + card grid */}
        {selectedWeek && (() => {
          const weekIdx = weeks.indexOf(selectedWeek);
          const canBack = weekIdx + 1 < weeks.length;
          const canForward = weekIdx > 0;
          function goToWeek(w: string) {
            setSelectedWeek(w);
            router.replace(`?week=${w}`, { scroll: false });
          }
          return (
            <>
              {/* Mobile: compact arrow row */}
              <div className="gr-rk-week-row">
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
                <span className="gr-rk-week-label">{fmtWeekShort(selectedWeek)}</span>
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

              {/* Desktop: card grid with margin arrows */}
              <div className="gr-rk-nav-wrap">
                <button
                  className="gr-rk-nav-arrow gr-rk-nav-arrow--left"
                  disabled={!canBack}
                  onClick={() => canBack && goToWeek(weeks[weekIdx + 1])}
                  aria-label="Föregående vecka"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <div className="gr-rk-grid">
          {loading
            ? [0, 1, 2].map((i) => (
                <div key={i} className="gr-vc gr-rk-vk-card gr-rk-vk-card--loading">
                  <div className="gr-thumb" />
                  <div className="gr-vid-info">
                    <div className="gr-rk-skel-bar" style={{ width: "60%", background: "rgba(28,27,25,0.1)" }} />
                  </div>
                </div>
              ))
            : accounts.slice(0, 3).map((acc, i) => (
                <div key={acc.handle} className="gr-vc gr-rk-vk-card">
                  <a
                    href={acc.bestVideo.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gr-thumb"
                  >
                    {acc.bestVideo.thumbnail_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={acc.bestVideo.thumbnail_url}
                        alt=""
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
                      />
                    )}
                    <div className="gr-thumb-stats">
                      <span><ThumbsUp size={9} />{fmt(acc.bestVideo.likes)}</span>
                      <span><MessageCircle size={9} />{fmt(acc.bestVideo.comments)}</span>
                      <span><Share2 size={9} />{fmt(acc.bestVideo.shares)}</span>
                      <span><Eye size={9} />{fmt(acc.bestVideo.views)}</span>
                    </div>
                    <span className="gr-thumb-er gr-rk-vk-er" style={{ color: rankColor(i) }}>
                      {acc.bestEngagement.toFixed(2)}%
                    </span>
                    <span className="gr-thumb-best" style={{ background: rankColor(i) }}>
                      #{i + 1}
                    </span>
                    <span className="gr-rk-vk-link" aria-hidden="true">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </span>
                  </a>
                  <div className="gr-vid-info">
                    <a href={`/konto/${acc.handle}`} className="gr-rk-vk-name">
                      {acc.displayName}
                    </a>
                  </div>
                </div>
              ))
          }
                </div>
                <button
                  className="gr-rk-nav-arrow gr-rk-nav-arrow--right"
                  disabled={!canForward}
                  onClick={() => canForward && goToWeek(weeks[weekIdx - 1])}
                  aria-label="Nästa vecka"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              </div>
            </>
          );
        })()}
      </section>

      {/* ── KALKYLATOR ───────────────────────────────────────────────── */}
      <section className="gr-calc-section" id="kalkylator">
        <div className="gr-calc-section-inner">
          <h2 className="gr-calc-h2">Hur engagerande är ditt innehåll?</h2>
          <div className="gr-calc-desc">
            <p>
              För att ta reda på hur engagerande ditt innehåll är, klistra in länken här, så räknar vi ut ett resultat och jämför det mot andra framgångsrika svenska TikTok-konton.
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
            <div className="gr-kalky-v2-skel" style={{ marginTop: 32 }}>
              <div className="gr-kalky-v2-skel-thumb" />
              <div className="gr-kalky-v2-skel-right">
                <div className="gr-kalky-v2-skel-bar" style={{ width: "35%", height: 10 }} />
                <div className="gr-kalky-v2-skel-bar" style={{ width: "55%", height: 56, marginTop: 8 }} />
                <div className="gr-kalky-v2-skel-bar" style={{ width: "75%", height: 10, marginTop: 14 }} />
                <div className="gr-kalky-v2-skel-bar" style={{ height: 5, marginTop: 8 }} />
                {[40, 30, 55, 35].map((w, i) => (
                  <div key={i} className="gr-kalky-v2-skel-bar" style={{ width: `${w}%`, height: 14, marginTop: i === 0 ? 18 : 8 }} />
                ))}
              </div>
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

              {/* Low-views warning */}
              {calcStats.views < 10000 && (
                <div className="gr-kalky-v2-notice gr-kalky-v2-notice--warn" style={{ marginBottom: 16 }}>
                  Videon har färre än 10 000 visningar. ER-jämförelsen är mindre tillförlitlig på låg räckvidd.
                </div>
              )}

              {/* 2-col result body */}
              <div className="gr-kalky-v2-result-body">
                {/* Left: thumbnail + copy + cache note */}
                <div className="gr-kalky-v2-result-left">
                  {/* Always reserve thumbnail space to prevent layout shift */}
                  <button
                    className="gr-kalky-v2-thumb-btn"
                    onClick={calcThumb ? () => setCalcLightbox(true) : undefined}
                    aria-label={calcThumb ? "Spela upp video" : undefined}
                    style={{ cursor: calcThumb ? "pointer" : "default" }}
                  >
                    {calcThumb && (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={calcThumb} alt="" className="gr-kalky-v2-thumb" />
                        <div className="gr-kalky-v2-play">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
                        </div>
                      </>
                    )}
                  </button>
                  <button
                    className="gr-kalky-v2-copy-btn"
                    onClick={() => { navigator.clipboard.writeText(window.location.href); setCalcCopied(true); setTimeout(() => setCalcCopied(false), 2000); }}
                  >
                    {calcCopied ? "Kopierad!" : "Kopiera länk"}
                  </button>
                  {calcLastUpdated && (
                    <p className="gr-kalky-v2-cache-note" style={{ marginBottom: 0 }}>
                      Statistik hämtad {new Date(calcLastUpdated).toLocaleDateString("sv-SE")}
                    </p>
                  )}
                </div>

                {/* Right: ER + bench + stats */}
                <div className="gr-kalky-v2-result-right">
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
                            <span>Låg</span><span>Medel</span><span>Hög</span>
                          </div>
                        </>
                      )}
                      <div className="gr-kalky-v2-stats-col">
                        {[
                          { lbl: "Visningar", val: calcStats.views },
                          { lbl: "Likes", val: calcStats.likes },
                          { lbl: "Kommentarer", val: calcStats.comments },
                          { lbl: "Delningar", val: calcStats.shares },
                        ].map(({ lbl, val }) => (
                          <div key={lbl} className="gr-kalky-v2-stat-row">
                            <span className="gr-kalky-v2-stat-lbl">{lbl}</span>
                            <span className="gr-kalky-v2-stat-val">{val.toLocaleString("sv-SE")}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="gr-kalky-v2-er-empty">Ingen ER (saknar visningar)</p>
                  )}
                </div>
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


      {/* ── FAQ / OM SOCIALA RAKETER ─────────────────────────────────── */}
      <section className="gr-faq-section" id="om-engagemang">
        <div className="gr-faq-inner">
          <h2 className="gr-faq-h2">Om Sociala Raketer</h2>
          <div className="gr-faq-list">
            {([
              {
                q: "Hur beräknas engagemangsgraden?",
                body: (
                  <>
                    <p>Vi använder formeln <em>(likes + kommentarer × 5 + delningar × 10) / visningar × 100</em>. Delningar väger tyngst — de kräver att tittaren aktivt väljer att förknippa sig med innehållet och exponerar det för sitt eget nätverk. Kommentarer kräver mer av tittaren än en like men mindre än en delning. Det ger en rättvisare bild av vad som faktiskt berör.</p>
                  </>
                ),
              },
              {
                q: "Varför filtreras tävlingsvideor bort?",
                body: (
                  <>
                    <p>Tävlingar uppmanar folk att gilla, kommentera och dela i utbyte mot en chans att vinna. Det är engagemang med doping — siffrorna ser imponerande ut men säger ingenting om innehållets faktiska kvalitet. Vi flaggar dessa videor automatiskt och exkluderar dem från rankningen.</p>
                  </>
                ),
              },
              {
                q: "Vilka konton mäts?",
                body: (
                  <>
                    <p>Svenska företag och organisationer som använder TikTok i sin kommunikation. Inte privatpersoner eller kreatörer. Varje vecka utvärderas hundratals videor automatiskt, och det bästa innehållet lyfts fram i topplistan.</p>
                  </>
                ),
              },
              {
                q: "Hur ofta uppdateras topplistan?",
                body: (
                  <>
                    <p>Varje måndag. Vi hämtar videor publicerade de senaste 14 dagarna och rankar konton på sin bästa enskilda video för veckan — den med högst engagemangsgrad.</p>
                  </>
                ),
              },
              {
                q: "Vårt konto är inte med — hur lägger vi till det?",
                body: (
                  <>
                    <p>Fyll i formuläret nedan med länk till ert TikTok-konto. Vi prioriterar svenska företag och organisationer och mäter för tillfället bara ett mindre urval av konton vars innehåll och engagemang sticker ut.</p>
                    {nomForm.status === "ok" ? (
                      <p className="gr-faq-msg gr-faq-msg--ok">{nomForm.msg}</p>
                    ) : (
                      <form className="gr-faq-form" onSubmit={submitNomination}>
                        <div className="gr-faq-form-row">
                          <input
                            className="gr-faq-input"
                            type="text"
                            placeholder="@tiktok-konto"
                            value={nomForm.handle}
                            onChange={(e) => setNomForm((p) => ({ ...p, handle: e.target.value }))}
                            required
                          />
                          <input
                            className="gr-faq-input"
                            type="email"
                            placeholder="din@email.se"
                            value={nomForm.email}
                            onChange={(e) => setNomForm((p) => ({ ...p, email: e.target.value }))}
                            required
                          />
                          <button className="gr-faq-submit" type="submit" disabled={nomForm.status === "loading"}>
                            {nomForm.status === "loading" ? "…" : "Nominera"}
                          </button>
                        </div>
                        {nomForm.status === "err" && <p className="gr-faq-msg gr-faq-msg--err">{nomForm.msg}</p>}
                      </form>
                    )}
                  </>
                ),
              },
              {
                q: "Jag vill vara beta-testare",
                body: (
                  <>
                    <p>Just nu bygger vi en dashboard för dig som vill ha bättre översikt över ditt TikTok-innehåll. Du får detaljerad statistik per video, genomsnitt och totala resultat — men framför allt möjligheten att jämföra mot konkurrenter och andra konton i din kategori. Begränsat antal platser. Anmäl intresse nedan.</p>
                    {faqBetaForm.status === "ok" ? (
                      <p className="gr-faq-msg gr-faq-msg--ok">{faqBetaForm.msg}</p>
                    ) : (
                      <form className="gr-faq-form" onSubmit={submitFaqBeta}>
                        <div className="gr-faq-form-row">
                          <input
                            className="gr-faq-input"
                            type="text"
                            placeholder="@tiktok-konto"
                            value={faqBetaForm.handle}
                            onChange={(e) => setFaqBetaForm((p) => ({ ...p, handle: e.target.value }))}
                            required
                          />
                          <input
                            className="gr-faq-input"
                            type="email"
                            placeholder="din@email.se"
                            value={faqBetaForm.email}
                            onChange={(e) => setFaqBetaForm((p) => ({ ...p, email: e.target.value }))}
                            required
                          />
                          <button className="gr-faq-submit" type="submit" disabled={faqBetaForm.status === "loading"}>
                            {faqBetaForm.status === "loading" ? "…" : "Anmäl intresse"}
                          </button>
                        </div>
                        {faqBetaForm.status === "err" && <p className="gr-faq-msg gr-faq-msg--err">{faqBetaForm.msg}</p>}
                      </form>
                    )}
                  </>
                ),
              },
              {
                q: "Vem ligger bakom Sociala Raketer?",
                body: (
                  <>
                    <p><a href="https://www.linkedin.com/in/rickardberggren/" target="_blank" rel="noopener noreferrer" className="gr-faq-link">Rickard Berggren</a>, digital strateg som jobbat med sociala medier och content i 12 år. Brinner för internetkultur och innehåll som verkligen berör och engagerar. Projektet startade 2026 som ett sätt att lyfta fram det som faktiskt fungerar — inte det som syns mest.</p>
                  </>
                ),
              },
            ] as { q: string; body: React.ReactNode }[]).map((item, i) => (
              <div key={i} className="gr-faq-item">
                <button
                  className={`gr-faq-q${faqOpen === i ? " gr-faq-q--open" : ""}`}
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  aria-expanded={faqOpen === i}
                >
                  <span>{item.q}</span>
                  <svg className={`gr-faq-chevron${faqOpen === i ? " gr-faq-chevron--open" : ""}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {faqOpen === i && (
                  <div className="gr-faq-body">{item.body}</div>
                )}
              </div>
            ))}
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
            <a href="#topplistan" className="gr-footer-v2-link">Veckans raketer</a>
            <a href="#kalkylator" className="gr-footer-v2-link">Räkna ut engagemang</a>
            <a href="#om-engagemang" className="gr-footer-v2-link">Om Sociala Raketer</a>
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
