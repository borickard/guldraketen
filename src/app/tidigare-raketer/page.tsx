"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

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

export default function TidigareRaketerPage() {
  const [data, setData] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tidigare-raketer")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, []);

  return (
    <main className="gr-root gr-page">
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 24px" }}>
        <h1 className="gr-page-title">Tidigare raketer</h1>
        <p className="gr-page-lead" style={{ marginBottom: 32 }}>
          Veckans vinnare — kontot med högst engagemangsgrad på sin bästa video.
        </p>

        {loading ? (
          <div className="gr-loading">Laddar...</div>
        ) : data.length === 0 ? (
          <p className="gr-page-body">Inga vinnare ännu.</p>
        ) : (
          <div className="gr-raketer-grid">
            {data.map((w) => (
              <a
                key={w.week}
                href={w.bestVideo.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="gr-raket-card"
              >
                <div className="gr-raket-thumb">
                  {w.bestVideo.thumbnail_url ? (
                    <Image
                      src={w.bestVideo.thumbnail_url}
                      alt={w.bestVideo.caption ?? w.displayName}
                      fill
                      sizes="240px"
                      style={{ objectFit: "cover" }}
                      unoptimized
                    />
                  ) : (
                    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 32, color: "rgba(28,27,25,.1)" }}>
                        {w.displayName[0]}
                      </span>
                    </div>
                  )}
                  <span className="gr-thumb-views" style={{ bottom: 8, right: 8 }}>
                    {fmt(w.bestVideo.views)}
                  </span>
                </div>
                <div className="gr-raket-info">
                  <div className="gr-raket-week">{fmtWeek(w.week)}</div>
                  <div className="gr-raket-name" style={{ color: "#C8962A" }}>
                    {w.displayName}
                  </div>
                  <div className="gr-raket-eng">
                    {Number(w.bestVideo.engagement_rate).toFixed(2)}% eng.
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
