import { getVideoForRank } from "@/lib/getVideoForRank";

const RANK_MAP: Record<string, number> = { guld: 1, silver: 2, brons: 3 };
const RANK_ROCKET_LABEL: Record<string, string> = { guld: "Guldraket", silver: "Silverraket", brons: "Bronsraket" };
const RANK_MEDAL: Record<string, string> = { guld: "🥇", silver: "🥈", brons: "🥉" };

export default async function OgPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; rank?: string }>;
}) {
  const { week = "2026-W12", rank: rankParam = "guld" } = await searchParams;
  const rankNum = RANK_MAP[rankParam] ?? (parseInt(rankParam.replace("top", "")) || 1);
  const video = await getVideoForRank(week, rankNum);

  // Use the current deployment URL so preview branches show their own OG image.
  // VERCEL_URL is set automatically by Vercel for every deployment (no protocol prefix).
  const deployUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : (process.env.NEXT_PUBLIC_SITE_URL ?? "https://guldraketen.vercel.app");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://guldraketen.vercel.app";
  const weekNum = parseInt(week.split("-W")[1]);
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
  // Fields table shows the current deployment's URL so the link is actually openable.
  const ogImageAbsolute = `${deployUrl}/api/og?week=${week}&rank=${rankNum}`;
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

  // Build quick-switch links for week/rank combos
  const ranks = ["guld", "silver", "brons"];

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#f5f5f0", minHeight: "100vh", padding: "32px 24px" }}>
      <div style={{ maxWidth: "1240px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 700, margin: "0 0 8px", color: "#1C1B19" }}>
            OG Image Preview
          </h1>
          <p style={{ margin: "0 0 16px", color: "#666", fontSize: "14px" }}>
            Visar hur OG-bilden ser ut i olika storlekar. Ändra <code>?week=2026-W12&rank=guld</code> i URL:en för att testa andra veckor/placeringar.
          </p>
          {/* Quick-switch */}
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
