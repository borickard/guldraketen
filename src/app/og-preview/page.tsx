import { getVideoForRank } from "@/lib/getVideoForRank";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const RANK_MAP: Record<string, number> = { guld: 1, silver: 2, brons: 3 };
const RANK_ROCKET_LABEL: Record<string, string> = { guld: "Guldraket", silver: "Silverraket", brons: "Bronsraket" };
const RANK_MEDAL: Record<string, string> = { guld: "🥇", silver: "🥈", brons: "🥉" };

function toISOWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum =
    1 + Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    );
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function isoWeekMinus(week: string, n: number): string {
  const [yearStr, weekStr] = week.split("-W");
  const year = parseInt(yearStr);
  const weekNum = parseInt(weekStr);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
  const monday = new Date(startOfWeek1);
  monday.setUTCDate(startOfWeek1.getUTCDate() + (weekNum - 1) * 7 - n * 7);
  return toISOWeek(monday);
}

async function getAvailableWeeks(): Promise<string[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 12 * 7);

  const { data } = await supabaseAdmin
    .from("videos")
    .select("published_at")
    .gte("published_at", cutoff.toISOString())
    .gte("views", 5000);

  const currentWeek = toISOWeek(new Date());
  const previousWeek = isoWeekMinus(currentWeek, 1);

  const weekSet = new Set<string>();
  for (const row of data ?? []) {
    if (row.published_at) {
      const w = toISOWeek(new Date(row.published_at));
      if (w !== currentWeek && w !== previousWeek) weekSet.add(w);
    }
  }

  return Array.from(weekSet).sort((a, b) => (b > a ? 1 : -1));
}

export default async function OgPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; rank?: string }>;
}) {
  const { week: weekParam, rank: rankParam = "guld" } = await searchParams;

  const weeks = await getAvailableWeeks();
  const week = weekParam ?? weeks[0] ?? "2026-W01";

  const weekIdx = weeks.indexOf(week);
  const prevWeek = weekIdx + 1 < weeks.length ? weeks[weekIdx + 1] : null;
  const nextWeek = weekIdx > 0 ? weeks[weekIdx - 1] : null;

  const rankNum = RANK_MAP[rankParam] ?? (parseInt(rankParam.replace("top", "")) || 1);
  const video = await getVideoForRank(week, rankNum);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://guldraketen.vercel.app";
  const weekNum = parseInt(week.split("-W")[1]);
  const weekYear = week.split("-W")[0];
  const acct = Array.isArray(video?.accounts) ? video?.accounts[0] : video?.accounts;
  const accountName = acct?.display_name ?? (video ? `@${video.handle}` : "Okänt konto");
  const er = video?.engagement_rate != null
    ? Number(video.engagement_rate).toFixed(2).replace(".", ",")
    : "–";
  const rocketLabel = RANK_ROCKET_LABEL[rankParam] ?? `Plats ${rankNum}`;
  const medal = RANK_MEDAL[rankParam] ?? "";

  const title = `${accountName} är ${rocketLabel} vecka ${weekNum}! ${medal}`;
  const description = `${accountName}s video hade ${er}% engagement rate. Sociala Raketer rankar Sveriges mest engagerande företag och organisationer på TikTok.`;
  const ogImageUrl = `/api/og?week=${week}&rank=${rankNum}`;
  const ogImageAbsolute = `${siteUrl}/api/og?week=${week}&rank=${rankNum}`;
  const pageUrl = `${siteUrl}/${week}/${rankParam}`;

  const fields = [
    { label: "og:title", value: title },
    { label: "og:description", value: description },
    { label: "og:url", value: pageUrl },
    { label: "og:image", value: ogImageAbsolute },
    { label: "og:image:width", value: "1200" },
    { label: "og:image:height", value: "630" },
    { label: "twitter:card", value: "summary_large_image" },
    { label: "twitter:title", value: title },
    { label: "twitter:description", value: description },
  ];

  const sizes = [
    { label: "Full (1200×630)", width: 1200, note: "Actual generated size" },
    { label: "LinkedIn feed (~552px wide)", width: 552, note: "Desktop feed card" },
    { label: "LinkedIn mobile (~328px wide)", width: 328, note: "Mobile feed card" },
  ];

  const ranks = ["guld", "silver", "brons"];

  const navBtnBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 16px",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: 600,
    textDecoration: "none",
    background: "#1C1B19",
    color: "#fff",
  };
  const navBtnDisabled: React.CSSProperties = {
    ...navBtnBase,
    background: "#e0dbd5",
    color: "#aaa",
    pointerEvents: "none",
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#f5f5f0", minHeight: "100vh", padding: "32px 24px" }}>
      <div style={{ maxWidth: "1240px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 700, margin: "0 0 8px", color: "#1C1B19" }}>
            OG Image Preview
          </h1>

          {/* Week navigation */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            {prevWeek ? (
              <a href={`/og-preview?week=${prevWeek}&rank=${rankParam}`} style={navBtnBase}>
                ← {prevWeek.replace("-W", " V")}
              </a>
            ) : (
              <span style={navBtnDisabled}>←</span>
            )}

            <span style={{ fontSize: "16px", fontWeight: 700, color: "#1C1B19", minWidth: "100px", textAlign: "center" }}>
              V{weekNum} {weekYear}
            </span>

            {nextWeek ? (
              <a href={`/og-preview?week=${nextWeek}&rank=${rankParam}`} style={navBtnBase}>
                {nextWeek.replace("-W", " V")} →
              </a>
            ) : (
              <span style={navBtnDisabled}>→</span>
            )}
          </div>

          {/* Rank switcher */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {ranks.map((r) => (
              <a
                key={r}
                href={`/og-preview?week=${week}&rank=${r}`}
                style={{
                  padding: "6px 14px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  textDecoration: "none",
                  background: rankParam === r ? "#1C1B19" : "#e0dbd5",
                  color: rankParam === r ? "#fff" : "#1C1B19",
                }}
              >
                {RANK_MEDAL[r]} {r.charAt(0).toUpperCase() + r.slice(1)}
              </a>
            ))}
          </div>
        </div>

        {/* Image previews */}
        <div style={{ display: "flex", flexDirection: "column", gap: "48px", marginBottom: "48px" }}>
          {sizes.map(({ label, width, note }) => (
            <div key={label}>
              <div style={{ marginBottom: "10px" }}>
                <span style={{ fontSize: "15px", fontWeight: 600, color: "#1C1B19" }}>{label}</span>
                <span style={{ fontSize: "13px", color: "#888", marginLeft: "10px" }}>{note}</span>
              </div>
              <div style={{ width: `${width}px`, maxWidth: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.15)", borderRadius: "4px", overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ogImageUrl}
                  alt="OG preview"
                  style={{ width: "100%", height: "auto", display: "block" }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* OG fields table */}
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 16px", color: "#1C1B19" }}>
            OG / Meta fields
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", background: "#fff", borderRadius: "8px", overflow: "hidden", boxShadow: "0 1px 8px rgba(0,0,0,0.08)" }}>
            <thead>
              <tr style={{ background: "#1C1B19", color: "#fff" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", width: "220px", fontWeight: 600 }}>Field</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600 }}>Value</th>
              </tr>
            </thead>
            <tbody>
              {fields.map(({ label, value }, i) => (
                <tr key={label} style={{ background: i % 2 === 0 ? "#fff" : "#f9f8f6", borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "12px 16px", color: "#888", fontFamily: "monospace", fontSize: "12px", verticalAlign: "top" }}>{label}</td>
                  <td style={{ padding: "12px 16px", color: "#1C1B19", wordBreak: "break-all" }}>
                    {label === "og:image" ? (
                      <a href={value} target="_blank" rel="noopener noreferrer" style={{ color: "#0066cc" }}>{value}</a>
                    ) : value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
