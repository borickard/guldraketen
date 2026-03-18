"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef, useLayoutEffect } from "react";
import Image from "next/image";

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
    const sorted = [...vids].sort(
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

export default function Home() {
  const [weeks, setWeeks] = useState<string[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [videos, setVideos] = useState<RawVideo[]>([]);
  const [prevVideos, setPrevVideos] = useState<RawVideo[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reachFilter, setReachFilter] = useState<"off" | "low" | "high">("off");
  const wordmarkRef = useRef<HTMLSpanElement>(null);
  const navLinksRef = useRef<HTMLButtonElement>(null);

  // Fit wordmark to available nav width
  useEffect(() => {
    const fit = () => {
      const wm = wordmarkRef.current;
      const links = navLinksRef.current;
      if (!wm || !links) return;
      const navWidth = wm.parentElement?.offsetWidth ?? 0;
      const linksWidth = links.offsetWidth + 48; // 48 = gap + padding
      const available = navWidth - linksWidth;
      let size = 48;
      wm.style.fontSize = size + "px";
      while (wm.scrollWidth > available && size > 14) {
        size -= 1;
        wm.style.fontSize = size + "px";
      }
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // Fetch available weeks
  useEffect(() => {
    fetch("/api/weeks")
      .then((r) => r.json())
      .then((ws: string[]) => {
        setWeeks(ws);
        if (ws.length > 0) setSelectedWeek(ws[0]);
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

  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const v = acc.bestVideo.views ?? 0;
      if (v < 10_000) return false;
      if (reachFilter === "off") return true;
      if (reachFilter === "low") return v < 100_000;
      if (reachFilter === "high") return v >= 100_000;
      return true;
    });
  }, [accounts, reachFilter]);

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

  const fSyne = "'Syne', sans-serif";
  const fMono = "'DM Mono', monospace";
  const fSans = "'DM Sans', sans-serif";

  return (
    <>
      <div style={{ background: C.bg, color: C.dark, fontFamily: fSans, overflow: "hidden", minHeight: "100vh" }}>

        {/* ── NAV ──────────────────────────────────────────────────── */}
        <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 24px", borderBottom: `1px solid ${C.line}`, gap: "24px", overflow: "hidden" }}>
          <span ref={wordmarkRef} style={{ fontFamily: fSyne, fontWeight: 800, fontSize: "16px", letterSpacing: ".02em", textTransform: "uppercase", flexShrink: 0, display: "flex", alignItems: "center", lineHeight: 1, whiteSpace: "nowrap" }}>
            <span style={{ color: C.gold }}>G</span>uldraketen
          </span>
          <button ref={navLinksRef} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", display: "flex", flexDirection: "column", gap: "5px", flexShrink: 0, alignSelf: "center" }}>
            <span style={{ display: "block", width: "22px", height: "2px", background: C.dark, borderRadius: "2px" }} />
            <span style={{ display: "block", width: "22px", height: "2px", background: C.dark, borderRadius: "2px" }} />
            <span style={{ display: "block", width: "14px", height: "2px", background: C.dark, borderRadius: "2px" }} />
          </button>
        </nav>

        {/* ── TICKER ───────────────────────────────────────────────── */}
        <div style={{ background: C.dark, padding: "8px 0", overflow: "hidden", whiteSpace: "nowrap" }}>
          <span className="gr-ticker">
            Vem nådde fram i bruset den här veckan?&nbsp;&middot;&nbsp;Guldraketen&nbsp;&middot;&nbsp;Varje måndag&nbsp;&middot;&nbsp;Likes räknas&nbsp;&middot;&nbsp;Kommentarer väger mer&nbsp;&middot;&nbsp;Delningar väger tyngst&nbsp;&middot;&nbsp;Det är vår måttstock&nbsp;&middot;&nbsp;Sveriges mest engagerande TikTok-konton&nbsp;&middot;&nbsp;{selectedWeek}&nbsp;&middot;&nbsp;
            Vem nådde fram i bruset den här veckan?&nbsp;&middot;&nbsp;Guldraketen&nbsp;&middot;&nbsp;Varje måndag&nbsp;&middot;&nbsp;Likes räknas&nbsp;&middot;&nbsp;Kommentarer väger mer&nbsp;&middot;&nbsp;Delningar väger tyngst&nbsp;&middot;&nbsp;Det är vår måttstock&nbsp;&middot;&nbsp;Sveriges mest engagerande TikTok-konton&nbsp;&middot;&nbsp;{selectedWeek}&nbsp;&middot;&nbsp;
          </span>
        </div>

        {/* ── LIST HEADER ──────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 24px", borderBottom: `1px solid ${C.line}`, gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexShrink: 0 }}>
            <span style={{ fontFamily: fSyne, fontWeight: 800, fontSize: "13px", color: "rgba(28,27,25,.55)", letterSpacing: ".04em", textTransform: "uppercase" }}>Filter</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <span style={{ fontFamily: fMono, fontSize: "8px", color: "rgba(28,27,25,.28)", letterSpacing: ".14em", textTransform: "uppercase", textAlign: "center" }}>Visningar</span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <ReachPill value={reachFilter} onChange={(v) => { setReachFilter(v === reachFilter ? "off" : v); setExpanded(null); }} />
                {reachFilter !== "off" && (
                  <button
                    onClick={() => { setReachFilter("off"); setExpanded(null); }}
                    style={{
                      display: "flex", alignItems: "center", gap: "5px",
                      fontFamily: fMono, fontSize: "10px", letterSpacing: ".06em",
                      textTransform: "uppercase", color: C.dark,
                      background: C.gold + "22", border: `1px solid ${C.gold}55`,
                      borderRadius: "100px", padding: "3px 10px 3px 12px",
                      cursor: "pointer", transition: "all 0.15s",
                    }}
                  >
                    {reachFilter === "low" ? "Under 100K" : "Över 100K"}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
          <select
            className="gr-wk-sel"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
          >
            {weeks.map((w) => (
              <option key={w} value={w}>{fmtWeek(w)}</option>
            ))}
          </select>
        </div>

        {/* ── ENTRIES ──────────────────────────────────────────────── */}
        {loading ? (
          <div style={{ padding: "40px 24px", fontFamily: fMono, fontSize: "11px", color: C.muted, letterSpacing: ".06em", textTransform: "uppercase" }}>
            Laddar...
          </div>
        ) : (
          filteredAccounts.map((acc, i) => {
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
                  <span className="gr-rank-col" style={{ fontFamily: fSyne, fontWeight: 500, fontSize: rankSize(i), color: rankColor(i), lineHeight: 1, flexShrink: 0, width: "clamp(36px, 8vw, 64px)", textAlign: "right" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  {/* Name + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: fSyne, fontWeight: 800, fontSize: companySize(i), color: textColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {acc.displayName}
                    </p>
                    <p style={{ fontFamily: fMono, fontSize: "10px", color: metaColor, marginTop: "4px", letterSpacing: ".04em", textTransform: "uppercase" }}>
                      {acc.videoCount} {acc.videoCount === 1 ? "inlägg" : "inlägg"}
                    </p>
                  </div>

                  {/* Eng.rate span — right side */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <span style={{ display: "block", fontFamily: fMono, fontSize: "13px", fontWeight: 500, color: statVal }}>
                      {(() => {
                        const rates = acc.videos.map(v => v.engagement_rate ?? 0);
                        const mn = Math.min(...rates);
                        const mx = Math.max(...rates);
                        return rates.length === 1
                          ? mx.toFixed(2) + "%"
                          : mn.toFixed(2) + "–" + mx.toFixed(2) + "%";
                      })()}
                    </span>
                    <span style={{ display: "block", fontFamily: fMono, fontSize: "9px", textTransform: "uppercase", letterSpacing: ".07em", color: statLbl, marginTop: "1px" }}>
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
                  <div className="gr-vinner" style={{ padding: "10px 24px 16px", position: "relative" }}>
                    {/* Panel summary */}
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "10px", paddingBottom: "10px", borderBottom: `1px solid ${isDark ? "rgba(255,255,255,.07)" : C.line}` }}>
                      <span style={{ fontFamily: fMono, fontSize: "10px", color: metaColor, letterSpacing: ".06em", textTransform: "uppercase" }}>
                        {acc.videoCount} {acc.videoCount === 1 ? "inlägg" : "inlägg"} veckan
                      </span>
                      <span style={{ fontFamily: fMono, fontSize: "10px", color: metaColor, letterSpacing: ".06em", textTransform: "uppercase" }}>
                        {fmt(acc.videos.reduce((s, v) => s + (v.views ?? 0), 0))} visningar totalt
                      </span>
                      <span style={{ fontFamily: fMono, fontSize: "10px", color: metaColor, letterSpacing: ".06em", textTransform: "uppercase" }}>
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
                        return (
                          <a
                            key={v.id}
                            href={v.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="gr-vc"
                            style={{ background: cardBg, border: cardBorder }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Thumbnail */}
                            <div style={{ width: "120px", height: "120px", borderRadius: "16.5px 16.5px 0 0", overflow: "hidden", position: "relative", background: "rgba(28,27,25,.08)", flexShrink: 0 }}>
                              {v.thumbnail_url ? (
                                <Image
                                  src={v.thumbnail_url}
                                  alt={v.caption ?? `Video ${vi + 1}`}
                                  fill
                                  sizes="120px"
                                  style={{ objectFit: "cover" }}
                                  unoptimized
                                />
                              ) : (
                                <span style={{ fontFamily: fSyne, fontWeight: 800, fontSize: "24px", color: "rgba(28,27,25,.09)", display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                                  {String(vi + 1).padStart(2, "0")}
                                </span>
                              )}
                              <span style={{ position: "absolute", bottom: "6px", right: "6px", background: C.dark, color: "rgba(235,231,226,.85)", fontFamily: fMono, fontSize: "9px", padding: "2px 6px", borderRadius: "8px", letterSpacing: ".03em" }}>
                                {fmt(v.views)}
                              </span>
                              {isBest && (
                                <span style={{ position: "absolute", top: "6px", left: "6px", background: C.gold, color: "#fff", fontFamily: fMono, fontSize: "8px", fontWeight: 500, padding: "2px 6px", borderRadius: "4px", letterSpacing: ".06em", textTransform: "uppercase" }}>
                                  Bäst
                                </span>
                              )}
                            </div>

                            {/* Info */}
                            <div style={{ padding: "7px 9px 9px" }}>
                              <p style={{ fontFamily: fSans, fontSize: "11px", fontWeight: 500, color: titleColor, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                                {v.caption ?? "Se video"}
                              </p>
                              <p style={{ fontFamily: fMono, fontSize: "10px", color: isBest ? C.gold : "rgba(28,27,25,.45)", marginTop: "4px", fontWeight: isBest ? 500 : 400 }}>
                                {Number(v.engagement_rate).toFixed(2)}% eng.
                              </p>
                            </div>
                          </a>
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

        {/* ── FOOTER ───────────────────────────────────────────────── */}
        <div style={{ background: C.dark, padding: "28px 24px 32px" }}>
          <div style={{ fontFamily: fSyne, fontWeight: 800, fontSize: "clamp(22px, 7vw, 50px)", color: C.lightText, lineHeight: 1, textTransform: "uppercase", letterSpacing: "-.01em" }}>
            Vad är<br />
            <span style={{ color: C.gold }}>Engagemang?</span>
          </div>
          <p style={{ fontFamily: fSans, fontSize: "14px", color: "rgba(235,231,226,.55)", marginTop: "20px", lineHeight: 1.7, maxWidth: "400px" }}>
            Likes i all ära. Men när någon kommenterar har de stannat upp — något väckte en reaktion. Och när de delar? Då har du nått fram genom bruset, rört något, och fått dem att säga: <em style={{ fontStyle: "italic", color: "rgba(235,231,226,.8)" }}>"det här måste du se."</em> Det är vår definition av engagemang.
          </p>
          <p style={{ fontFamily: fMono, fontSize: "9px", letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(235,231,226,.18)", marginTop: "24px" }}>
            Guldraketen&nbsp;&middot;&nbsp;2026
          </p>
        </div>

      </div>
    </>
  );
}