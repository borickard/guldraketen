"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef, useLayoutEffect, Suspense } from "react";
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
  bestVideo: RawVideo;       // the top-ranked video
  bestEngagement: number;    // engagement_rate of best video
  videoCount: number;
  videos: RawVideo[];        // all videos, best first
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAccount(v: RawVideo) {
  const acct = Array.isArray(v.accounts) ? v.accounts[0] : v.accounts;
  return acct ?? { followers: 0, display_name: null };
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

function ChevronRight({ color }: { color: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function TrendUp() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#2E8B55"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M18 15l-6-6-6 6" />
    </svg>
  );
}

function TrendDown() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#9B3A2A"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}



// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg: "#EBE7E2",
  dark: "#1C1B19",
  gold: "#C8962A",
  silver: "#8A9299",
  bronze: "#96614A",
  cardBg: "#E2DDD7",
  cardBorder: "rgba(28,27,25,0.16)",
  line: "rgba(28,27,25,0.08)",
  muted: "rgba(28,27,25,0.52)",
  lightText: "rgba(235,231,226,0.92)",
  lightMuted: "rgba(235,231,226,0.55)",
  lightStat: "rgba(235,231,226,0.48)",
  tickerText: "rgba(235,231,226,0.7)",
};

const RANK_COLORS = [C.gold, C.silver, C.bronze];

function rankColor(i: number) {
  return RANK_COLORS[i] ?? "rgba(28,27,25,0.11)";
}
function rankSize(i: number) {
  if (i === 0) return "clamp(32px, 8vw, 60px)";
  if (i === 1) return "clamp(26px, 6vw, 44px)";
  if (i === 2) return "clamp(22px, 5vw, 34px)";
  return "clamp(18px, 4vw, 26px)";
}
function companySize(i: number) {
  if (i === 0) return "26px";
  if (i === 1) return "20px";
  if (i === 2) return "17px";
  return "15px";
}
function rowMinHeight(i: number) {
  if (i === 0) return "82px";
  if (i === 1) return "70px";
  return "64px";
}

// ─── Component ────────────────────────────────────────────────────────────────


// ─── Reach filter pill ────────────────────────────────────────────────────────

type ReachFilter = "off" | "low" | "high";
const REACH_OPTIONS: { key: ReachFilter; label: string }[] = [
  { key: "low", label: "Låg" },
  { key: "high", label: "Hög" },
];

function VideoThumb({ src, alt, fallback }: { src: string | null; alt: string; fallback: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className="gr-thumb-placeholder">{fallback}</span>
    );
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

function ReachPill({
  value,
  onChange,
}: {
  value: ReachFilter;
  onChange: (v: ReachFilter) => void;
}) {
  const ref0 = useRef<HTMLButtonElement>(null);
  const ref1 = useRef<HTMLButtonElement>(null);
  const btnRefs = [ref0, ref1];
  const [hlStyle, setHlStyle] = useState({ left: 3, width: 60 });

  useLayoutEffect(() => {
    const idx = REACH_OPTIONS.findIndex((o) => o.key === value);
    if (idx === -1) { setHlStyle({ left: -200, width: 0 }); return; }
    const btn = btnRefs[idx]?.current;
    const track = btn?.parentElement;
    if (!btn || !track) return;
    const trackRect = track.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setHlStyle({
      left: btnRect.left - trackRect.left,
      width: btnRect.width,
    });
  }, [value]);

  return (
    <div className="gr-pill-track">
      <div
        className="gr-pill-highlight"
        style={{ left: hlStyle.left, width: hlStyle.width }}
      />
      {REACH_OPTIONS.map((opt, i) => (
        <button
          key={opt.key}
          ref={btnRefs[i]}
          className={"gr-pill-btn" + (value === opt.key ? " active" : "")}
          onClick={() => onChange(opt.key)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [weeks, setWeeks] = useState<string[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [videos, setVideos] = useState<RawVideo[]>([]);
  const [prevVideos, setPrevVideos] = useState<RawVideo[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [weekOpen, setWeekOpen] = useState(false);
  const wkRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 600);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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

    const fetchCurrent = fetch(`/api/videos?week=${selectedWeek}`).then((r) =>
      r.json()
    );

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

  // Map handle -> rank index for previous week
  const prevRankMap = useMemo(() => {
    const m = new Map<string, number>();
    prevAccounts.forEach((a, i) => m.set(a.handle, i));
    return m;
  }, [prevAccounts]);

  const toggle = useCallback((handle: string) => {
    setExpanded((e) => (e === handle ? null : handle));
  }, []);

  function scrollPanel(handle: string) {
    const el = document.getElementById(`scroll-${handle}`);
    if (el) el.scrollBy({ left: 280, behavior: "smooth" });
  }


  return (
    <>
      <div className="gr-root">

        {/* ── PAGE HEADER ──────────────────────────────────────────── */}
        <div className="gr-page-hdr">
          <h1 className="gr-page-title">
            Veckans raket
            {selectedWeek && (
              <span className="gr-wk-inline" ref={wkRef}>
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
                        onClick={() => {
                          setSelectedWeek(w);
                          router.replace(`?week=${w}`, { scroll: false });
                          setWeekOpen(false);
                        }}
                      >
                        {fmtWeek(w)}
                      </button>
                    ))}
                  </div>
                )}
              </span>
            )}
          </h1>
        </div>

        {/* ── MAIN GRID (list + CTA sidebar) ──────────────────────── */}
        <div className="gr-content-grid">
        <div className="gr-content-main">

        {/* ── ENTRIES ──────────────────────────────────────────────── */}
        {loading ? (
          <>
            {[1, 2, 3, 4, 5].map((_, i) => (
              <div key={i} className={`gr-skel-row${i === 0 ? " gr-skel-row-dark" : ""}`}>
                <span className="gr-skel-rank" />
                <div className="gr-skel-main">
                  <span className="gr-skel-name" style={{ width: `${140 - i * 12}px` }} />
                  <span className="gr-skel-meta" />
                </div>
                <span className="gr-skel-rate" />
              </div>
            ))}
          </>
        ) : (
          accounts.map((acc, i) => {
            const isDark = i === 0;
            const isOpen = expanded === acc.handle;

            const prevRank = prevRankMap.get(acc.handle);
            // positive = climbed, negative = dropped, null = new entry
            const delta = prevRank != null ? prevRank - i : null;
            const isNew = delta === null && prevVideos.length > 0;

            const textColor = isDark ? C.lightText : C.dark;
            const metaColor = isDark ? C.lightMuted : C.muted;
            const statLbl = isDark ? C.lightStat : "rgba(28,27,25,.48)";
            const statVal = isDark ? C.gold : rankColor(i);
            const chevColor = isOpen ? C.gold : (isDark ? "rgba(235,231,226,.18)" : "rgba(28,27,25,.2)");
            const rowBorder = isOpen ? "none" : `1px solid ${isDark ? "rgba(255,255,255,.06)" : C.line}`;

            return (
              <div
                key={acc.handle}
                className={`gr-entry${isDark ? " gr-entry-dark" : ""}`}
              >
                {/* Row */}
                <div
                  onClick={() => toggle(acc.handle)}
                  className="gr-entry-row-inner"
                  style={{ display: "flex", alignItems: "center", padding: "0 24px", gap: "20px", minHeight: rowMinHeight(i), borderBottom: rowBorder }}
                >
                  {/* Rank */}
                  <span className="gr-rank-col" style={{ fontWeight: 500, fontSize: rankSize(i), color: rankColor(i) }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  {/* Name + meta */}
                  <div className="gr-entry-main">
                    <p className="gr-entry-name" style={{ fontSize: companySize(i), color: textColor }}>
                      {acc.displayName}
                    </p>
                    <p className="gr-entry-meta" style={{ color: metaColor }}>
                      {acc.videoCount} {acc.videoCount === 1 ? "inlägg" : "inlägg"}
                    </p>
                  </div>

                  {/* Eng.rate span — right side */}
                  <div className="gr-entry-rate">
                    <span className="gr-entry-rate-val" style={{ color: statVal }}>
                      {(() => {
                        const rates = acc.videos.map(v => v.engagement_rate ?? 0);
                        const mn = Math.min(...rates);
                        const mx = Math.max(...rates);
                        return rates.length === 1
                          ? mx.toFixed(2) + "%"
                          : mn.toFixed(2) + "–" + mx.toFixed(2) + "%";
                      })()}
                    </span>
                    <span className="gr-entry-rate-lbl" style={{ color: statLbl }}>
                      eng.rate
                    </span>
                  </div>

                  {/* Chevron */}
                  <div className={`gr-chev${isOpen ? " open" : ""}`}>
                    <ChevronRight color={chevColor} />
                  </div>
                </div>

                {/* Video panel */}
                <div className={`gr-vpanel${isOpen ? " open" : ""}`}>
                  <div className="gr-vinner">
                    {/* Panel summary */}
                    <div className="gr-panel-summary" style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,.07)" : C.line}` }}>
                      <span className="gr-panel-meta" style={{ color: metaColor }}>
                        {acc.videoCount} {acc.videoCount === 1 ? "inlägg" : "inlägg"} veckan
                      </span>
                      <span className="gr-panel-meta" style={{ color: metaColor }}>
                        {fmt(acc.videos.reduce((s, v) => s + (v.views ?? 0), 0))} visningar totalt
                      </span>
                      <span className="gr-panel-meta" style={{ color: metaColor }}>
                        {(() => {
                          const totalViews = acc.videos.reduce((s, v) => s + (v.views ?? 0), 0);
                          const wavg = totalViews > 0
                            ? acc.videos.reduce((s, v) => s + (v.engagement_rate ?? 0) * (v.views ?? 0), 0) / totalViews
                            : 0;
                          return wavg.toFixed(2);
                        })()}% snitt eng.rate
                      </span>
                    </div>
                    <div className="gr-srow" id={`scroll-${acc.handle}`}>
                      {acc.videos.map((v, vi) => {
                        const isBest = vi === 0;
                        const cardBg = isBest
                          ? (isDark ? "#3A3320" : "#F5EDD8")
                          : undefined;
                        const cardBorder = isBest
                          ? `1.5px solid ${C.gold}`
                          : undefined;
                        const titleColor = isDark ? "rgba(235,231,226,.9)" : C.dark;
                        const vid = v.video_url.match(/\/video\/(\d+)/)?.[1];
                        return (
                          <div
                            key={v.id}
                            className="gr-vc"
                            style={{ background: cardBg, border: cardBorder }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <a
                              href={v.video_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="gr-vc-link"
                            >
                              {/* Thumbnail */}
                              <div className="gr-thumb">
                                <VideoThumb
                                  src={v.thumbnail_url}
                                  alt={v.caption ?? `Video ${vi + 1}`}
                                  fallback={String(vi + 1).padStart(2, "0")}
                                />
                                <span className="gr-thumb-views">
                                  {fmt(v.views)}
                                </span>
                                <div className="gr-thumb-stats">
                                  <span>
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z"/></svg>
                                    {fmt(v.likes)}
                                  </span>
                                  <span>
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c-4.97 0-9 3.186-9 7.115 0 2.055.999 3.898 2.604 5.207-.141.994-.671 2.716-2.604 3.678 2.132-.142 4.658-1.113 5.922-2.203C9.883 16.943 10.925 17 12 17c4.97 0 9-3.186 9-7.115C21 6.186 16.97 3 12 3z"/></svg>
                                    {fmt(v.comments)}
                                  </span>
                                  <span>
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 014-4h12"/></svg>
                                    {fmt(v.shares)}
                                  </span>
                                </div>
                                {isBest && (
                                  <span className="gr-thumb-best">
                                    Bäst
                                  </span>
                                )}
                              </div>

                              {/* Info */}
                              <div className="gr-vid-info">
                                <p className="gr-vid-title" style={{ color: titleColor }}>
                                  {v.caption ?? "Se video"}
                                </p>
                                <p className="gr-vid-eng" style={{ color: isBest ? C.gold : "rgba(28,27,25,.45)", fontWeight: isBest ? 500 : 400 }}>
                                  {Number(v.engagement_rate).toFixed(2)}% eng.
                                </p>
                              </div>
                            </a>

                          </div>
                        );
                      })}
                    </div>

                    {/* Scroll arrow */}
                    {acc.videos.length > 3 && (
                      <button
                        className="gr-arr"
                        onClick={(e) => { e.stopPropagation(); scrollPanel(acc.handle); }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        </div>{/* end gr-content-main */}

        {/* ── CTA SIDEBAR ──────────────────────────────────────────── */}
        <div className="gr-content-aside">
          <div className="gr-cta">
            <p className="gr-cta-label">För företag och organisationer</p>
            <h2 className="gr-cta-heading">Syns ditt bolag<br />i listan?</h2>
            <p className="gr-cta-body">
              Rankingen följer svenska företag och organisationer — inte kreatörer eller influencers. Vi letar efter innehåll som gör något med folk. Som stoppar tummen. Som väcker en reaktion. Som får någon att skicka vidare.
            </p>
            <p className="gr-cta-body">
              Om du skapar TikTok-innehåll för ett bolag eller en organisation: testa din bästa video i kalkylatorn. Håller engagemanget? Då kanske ni redan borde vara med.
            </p>
            <a href="/kalkylator" className="gr-cta-btn">Testa kalkylatorn</a>
          </div>
        </div>

        </div>{/* end gr-content-grid */}

        {/* ── FOOTER ───────────────────────────────────────────────── */}
        <div className="gr-footer">
          <div className="gr-footer-heading">
            Vad är<br />
            <span style={{ color: C.gold }}>Engagemang?</span>
          </div>
          <p className="gr-footer-body">
            Likes i all ära. Men när någon kommenterar har de stannat upp — något väckte en reaktion. Och när de delar? Då har du nått fram genom bruset, rört något, och fått dem att säga: <em className="gr-footer-em">"det här måste du se."</em> Det är vår definition av engagemang.
          </p>
          <p className="gr-footer-credit">
            Guldraketen&nbsp;&middot;&nbsp;2026&nbsp;&middot;&nbsp;<a href="/kalkylator" style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: "3px" }}>Kalkylator</a>
          </p>
        </div>

      </div>
    </>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeInner />
    </Suspense>
  );
}