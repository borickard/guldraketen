"use client";

import { useEffect, useState } from "react";

interface ScoreEntry {
  handle: string;
  displayName: string;
  totalPoints: number;
  gold: number;
  silver: number;
  bronze: number;
}

function MedalDot({ color }: { color: string }) {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" style={{ display: "inline-block", flexShrink: 0 }}>
      <circle cx="4" cy="4" r="4" fill={color} />
    </svg>
  );
}

export default function HofSection() {
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/topplistan")
      .then((r) => r.json())
      .then((d) => { setScores(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div style={s.root}>
      <h2 style={s.heading}>Hall of Fame</h2>
      <p style={s.sub}>Ackumulerade poäng · Guld 15p · Silver 10p · Brons 5p</p>
      {loading ? (
        <p style={s.empty}>Laddar…</p>
      ) : scores.length === 0 ? (
        <p style={s.empty}>Inga poäng ännu.</p>
      ) : (
        <ol style={s.list}>
          {scores.slice(0, 10).map((entry, i) => (
            <li key={entry.handle} style={s.item}>
              <span style={s.rank}>{i + 1}</span>
              <MedalDot color={["#C8962A", "#8A9299", "#96614A"][i] ?? "rgba(28,27,25,0.2)"} />
              <span style={s.name}>
                {entry.displayName || `@${entry.handle}`}
                <a href={`/konto/${entry.handle}`} style={s.profileLink} aria-label={`Visa profil`}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </a>
              </span>
              <span style={s.medals}>
                {entry.gold > 0 && <span style={s.medal}>{entry.gold}× <MedalDot color="#C8962A" /></span>}
                {entry.silver > 0 && <span style={s.medal}>{entry.silver}× <MedalDot color="#8A9299" /></span>}
                {entry.bronze > 0 && <span style={s.medal}>{entry.bronze}× <MedalDot color="#96614A" /></span>}
              </span>
              <span style={s.pts}>{entry.totalPoints}p</span>
            </li>
          ))}
        </ol>
      )}
      <a href="/hall-of-fame" style={s.cta}>
        Se alla vinnare
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </a>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    marginTop: "2.5rem",
    background: "#fff",
    border: "1.5px solid rgba(28,27,25,0.1)",
    borderRadius: 12,
    padding: "1.5rem",
    fontFamily: "'Barlow', sans-serif",
  },
  heading: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 22,
    letterSpacing: "0.02em",
    textTransform: "uppercase",
    color: "#1C1B19",
    marginBottom: 4,
  },
  sub: {
    fontSize: 12,
    color: "#999",
    marginBottom: "1.25rem",
    letterSpacing: "0.04em",
  },
  list: {
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },
  item: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0.6rem 0",
    borderBottom: "1px solid rgba(28,27,25,0.07)",
    fontSize: 14,
    color: "#1C1B19",
  },
  rank: {
    width: 20,
    color: "#999",
    fontSize: 12,
    fontWeight: 600,
    flexShrink: 0,
  },
  name: {
    flex: 1,
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: 6,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  profileLink: {
    color: "rgba(28,27,25,0.35)",
    display: "flex",
    alignItems: "center",
    textDecoration: "none",
    flexShrink: 0,
  },
  medals: {
    display: "flex",
    gap: 6,
    alignItems: "center",
  },
  medal: {
    display: "flex",
    alignItems: "center",
    gap: 3,
    fontSize: 12,
    color: "#888",
  },
  pts: {
    fontWeight: 700,
    fontSize: 14,
    color: "#C8962A",
    flexShrink: 0,
  },
  empty: {
    color: "#aaa",
    fontSize: 14,
    padding: "0.5rem 0",
  },
  cta: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    marginTop: "1rem",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: "#1C1B19",
    textDecoration: "none",
    opacity: 0.55,
  },
};
