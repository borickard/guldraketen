"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Winner {
  week: string;
  handle: string;
  displayName: string;
  bestVideo: {
    video_url: string;
    thumbnail_url: string | null;
    caption: string | null;
    views: number;
    engagement_rate: number;
  };
}

interface ScoreEntry {
  handle: string;
  displayName: string;
  totalPoints: number;
  gold: number;
  silver: number;
  bronze: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtWeek(w: string) {
  const m = w.match(/(\d{4})-W(\d{2})/);
  if (!m) return w;
  return `Vecka ${parseInt(m[2])}, ${m[1]}`;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return Math.round(n / 1_000) + "K";
  return String(n);
}

function medalStr(gold: number, silver: number, bronze: number) {
  const parts = [];
  if (gold) parts.push(`${gold}G`);
  if (silver) parts.push(`${silver}S`);
  if (bronze) parts.push(`${bronze}B`);
  return parts.join(" · ") || "—";
}

const MEDAL: Record<string, string> = {
  gold: "#C8962A",
  silver: "#8A9299",
  bronze: "#96614A",
};

// ── Thumb with error fallback ─────────────────────────────────────────────────

function Thumb({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "'Titan One', sans-serif", fontWeight: 800, fontSize: 24, color: "rgba(28,27,25,.1)" }}>
          {name[0]}
        </span>
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={name}
      fill
      sizes="200px"
      style={{ objectFit: "cover" }}
      unoptimized
      onError={() => setFailed(true)}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Tab = "raketer" | "konton";

function HallOfFameInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>((searchParams.get("tab") as Tab) ?? "raketer");

  const [winners, setWinners] = useState<Winner[]>([]);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [loadingWinners, setLoadingWinners] = useState(true);
  const [loadingScores, setLoadingScores] = useState(true);

  useEffect(() => {
    fetch("/api/tidigare-raketer")
      .then((r) => r.json())
      .then((d) => { setWinners(d); setLoadingWinners(false); });
    fetch("/api/topplistan")
      .then((r) => r.json())
      .then((d) => { setScores(d); setLoadingScores(false); });
  }, []);

  function switchTab(t: Tab) {
    setTab(t);
    router.replace(`?tab=${t}`, { scroll: false });
  }

  return (
    <main className="gr-root gr-page">
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "40px 24px" }}>
        <h1 className="gr-page-title">Hall of Fame</h1>

        {/* Tabs */}
        <div className="gr-hof-tabs">
          <button
            className={"gr-hof-tab" + (tab === "raketer" ? " gr-hof-tab--active" : "")}
            onClick={() => switchTab("raketer")}
          >
            Raketer
          </button>
          <button
            className={"gr-hof-tab" + (tab === "konton" ? " gr-hof-tab--active" : "")}
            onClick={() => switchTab("konton")}
          >
            Konton
          </button>
        </div>

        {/* Raketer tab */}
        {tab === "raketer" && (
          <>
            <p className="gr-page-lead" style={{ marginBottom: 24, marginTop: 24 }}>
              Veckans vinnare — kontot med högst engagemangsgrad på sin bästa video.
            </p>
            {loadingWinners ? (
              <div className="gr-loading">Laddar...</div>
            ) : winners.length === 0 ? (
              <p className="gr-page-body">Inga vinnare ännu.</p>
            ) : (
              <div className="gr-raketer-grid">
                {winners.map((w) => (
                  <a
                    key={w.week}
                    href={w.bestVideo.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gr-raket-card"
                  >
                    <div className="gr-raket-thumb">
                      <Thumb src={w.bestVideo.thumbnail_url} name={w.displayName} />
                      <span className="gr-thumb-views">{fmt(w.bestVideo.views)}</span>
                    </div>
                    <div className="gr-raket-info">
                      <div className="gr-raket-week">{fmtWeek(w.week)}</div>
                      <div className="gr-raket-name" style={{ color: "#C8962A" }}>{w.displayName}</div>
                      <div className="gr-raket-eng">{Number(w.bestVideo.engagement_rate).toFixed(2)}% eng.</div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </>
        )}

        {/* Konton tab */}
        {tab === "konton" && (
          <>
            <p className="gr-page-lead" style={{ marginBottom: 24, marginTop: 24 }}>
              Ackumulerade poäng baserade på veckovisa placeringar. 1:a ger 15p, 2:a ger 10p, 3:e ger 5p.
            </p>
            {loadingScores ? (
              <div className="gr-loading">Laddar...</div>
            ) : scores.length === 0 ? (
              <p className="gr-page-body">Inga poäng ännu.</p>
            ) : (
              <table className="gr-score-table" style={{ maxWidth: 680 }}>
                <thead>
                  <tr>
                    <th style={{ width: 32 }}>#</th>
                    <th>Konto</th>
                    <th>Medaljer</th>
                    <th>Poäng</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.map((entry, i) => {
                    const rank = i + 1;
                    const rankColor = rank === 1 ? MEDAL.gold : rank === 2 ? MEDAL.silver : rank === 3 ? MEDAL.bronze : undefined;
                    return (
                      <tr key={entry.handle} className="gr-score-row">
                        <td className="gr-score-rank" style={{ color: rankColor ?? "rgba(28,27,25,.3)" }}>{rank}</td>
                        <td className="gr-score-name">{entry.displayName}</td>
                        <td className="gr-score-medals">{medalStr(entry.gold, entry.silver, entry.bronze)}</td>
                        <td className="gr-score-pts" style={{ color: rankColor ?? "var(--gr-dark)" }}>{entry.totalPoints}p</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function HallOfFamePage() {
  return (
    <Suspense>
      <HallOfFameInner />
    </Suspense>
  );
}
