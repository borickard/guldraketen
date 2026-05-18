"use client";

import { useState } from "react";
import VideoGrid from "./VideoGrid";
import HeroBlock from "./HeroBlock";

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

      <HeroBlock handle={activeHandle} />

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
