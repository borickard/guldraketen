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

const MEDAL: Record<string, string> = {
  gold: "#C8962A",
  silver: "#8A9299",
  bronze: "#96614A",
};

function medalStr(gold: number, silver: number, bronze: number) {
  const parts = [];
  if (gold) parts.push(`${gold}G`);
  if (silver) parts.push(`${silver}S`);
  if (bronze) parts.push(`${bronze}B`);
  return parts.join(" · ") || "—";
}

export default function TopplictanPage() {
  const [data, setData] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/topplistan")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, []);

  return (
    <main className="gr-root gr-page">
      <div className="gr-page-content" style={{ maxWidth: 720 }}>
        <h1 className="gr-page-title">Topplistan</h1>
        <p className="gr-page-lead" style={{ marginBottom: 28 }}>
          Ackumulerade poäng baserade på veckovisa placeringar. 1:a plats ger 15p, 2:a ger 10p, 3:e ger 5p.
        </p>

        {loading ? (
          <div className="gr-loading">Laddar...</div>
        ) : data.length === 0 ? (
          <p className="gr-page-body">Inga poäng ännu.</p>
        ) : (
          <table className="gr-score-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}>#</th>
                <th>Konto</th>
                <th>Medaljer</th>
                <th>Poäng</th>
              </tr>
            </thead>
            <tbody>
              {data.map((entry, i) => {
                const rank = i + 1;
                const rankColor = rank === 1 ? MEDAL.gold : rank === 2 ? MEDAL.silver : rank === 3 ? MEDAL.bronze : undefined;
                return (
                  <tr key={entry.handle} className="gr-score-row">
                    <td className="gr-score-rank" style={{ color: rankColor ?? "rgba(28,27,25,.3)" }}>
                      {rank}
                    </td>
                    <td className="gr-score-name">
                      {entry.displayName}
                    </td>
                    <td className="gr-score-medals">
                      {medalStr(entry.gold, entry.silver, entry.bronze)}
                    </td>
                    <td className="gr-score-pts" style={{ color: rankColor ?? "var(--gr-dark)" }}>
                      {entry.totalPoints}p
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
