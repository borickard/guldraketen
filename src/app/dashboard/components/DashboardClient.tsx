"use client";

import { useState } from "react";
import VideoGrid from "./VideoGrid";

interface ProfileData {
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  followers: number | null;
  tracked_since: string;
  post_count: number;
  avg_er: number | null;
  posts_per_week: number;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmt(n: number | null | undefined): string {
  if (n == null) return "";
  return n.toLocaleString("sv-SE");
}

export default function DashboardClient({ profiles }: { profiles: ProfileData[] }) {
  const [activeHandle, setActiveHandle] = useState(profiles[0]?.handle ?? "");
  const profile = profiles.find((p) => p.handle === activeHandle) ?? profiles[0];

  if (!profile) return null;

  const multiHandle = profiles.length > 1;

  return (
    <>
      <style>{css}</style>

      {multiHandle && (
        <div className="dc-tabs">
          {profiles.map((p) => (
            <button
              key={p.handle}
              className={`dc-tab${activeHandle === p.handle ? " dc-tab--on" : ""}`}
              onClick={() => setActiveHandle(p.handle)}
            >
              {p.display_name ?? `@${p.handle}`}
            </button>
          ))}
        </div>
      )}

      <div className="db-profile-block">
        <div className="db-identity">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt={profile.handle} className="db-avatar" />
          ) : (
            <div className="db-avatar db-avatar--placeholder" />
          )}
          <div className="db-identity-info">
            <h1 className="db-displayname">{profile.display_name ?? `@${profile.handle}`}</h1>
            <p className="db-handle">@{profile.handle}</p>
            <p className="db-meta">
              {profile.followers != null ? `${fmt(profile.followers)} följare · ` : ""}
              Videor inhämtade sedan {formatDate(profile.tracked_since)}
            </p>
          </div>
        </div>

        <div className="db-stats">
          <div className="db-stat">
            <span className="db-stat-value">
              {profile.avg_er != null ? `${profile.avg_er.toFixed(2)}%` : "—"}
            </span>
            <span className="db-stat-label">Genomsnittlig engagemangsrate</span>
          </div>
          <div className="db-stat">
            <span className="db-stat-value">{profile.post_count}</span>
            <span className="db-stat-label">Videor inhämtade</span>
          </div>
          <div className="db-stat">
            <span className="db-stat-value">
              {profile.posts_per_week >= 1
                ? `${profile.posts_per_week.toFixed(1)}/vecka`
                : `${(profile.posts_per_week * 4.33).toFixed(1)}/mån`}
            </span>
            <span className="db-stat-label">Publiceringsfrekvens</span>
          </div>
        </div>
      </div>

      <VideoGrid handle={activeHandle} />
    </>
  );
}

const css = `
  .dc-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  .dc-tab {
    font-family: 'Barlow', sans-serif;
    font-size: 13px;
    font-weight: 600;
    padding: 0.4rem 1rem;
    background: #fff;
    border: 1.5px solid rgba(28,27,25,0.15);
    border-radius: 6px;
    color: #888;
    cursor: pointer;
    transition: border-color 0.12s, color 0.12s, background 0.12s;
  }

  .dc-tab:hover {
    border-color: rgba(28,27,25,0.4);
    color: #1C1B19;
  }

  .dc-tab--on {
    background: #1C1B19;
    border-color: #1C1B19;
    color: #EDF8FB;
  }

  .dc-tab--on:hover {
    color: #fff;
  }
`;
