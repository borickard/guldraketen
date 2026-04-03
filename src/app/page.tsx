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

  // Kalkylator-sektion state
  const [calcUrl, setCalcUrl] = useState("");
  const [calcUrlError, setCalcUrlError] = useState(false);

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


  function handleCalcSubmit() {
    const detected = detectCalcInput(calcUrl);
    if (!detected) { setCalcUrlError(true); return; }
    setCalcUrlError(false);
    if (detected.type === "short") {
      window.location.href = `/kalkylator?url=${encodeURIComponent(detected.url)}`;
      return;
    }
    const params = new URLSearchParams({ v: detected.videoId });
    if (detected.handle) params.set("h", detected.handle);
    window.location.href = `/kalkylator?${params}`;
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
                          <span className="gr-rk-card-pos">
                            {String(i + 1).padStart(2, "0")}
                          </span>
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
                        <div className="gr-rk-card-back-er" style={{ color: rankColor(i) }}>
                          {acc.bestEngagement.toFixed(2)}%
                          <span className="gr-rk-card-back-er-lbl"> eng.rate</span>
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
                        <a
                          href={acc.bestVideo.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="gr-rk-card-back-btn"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Visa videon
                        </a>
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
        </div>
      </section>

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
