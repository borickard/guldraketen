"use client";

import { useEffect, useState } from "react";
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

export type BoostFilter = "all" | "organic" | "boosted";

// Minimal subset of VideoGrid's Video interface — just the fields HeroBlock
// needs for client-side benchmark aggregation.
interface FilteredVideo {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  collect_count: number | null;
  engagement_rate: number | null;
  published_at: string | null;
  is_excluded?: boolean | null;
}

export default function DashboardClient({ profiles }: { profiles: ProfileData[] }) {
  const [activeHandle, setActiveHandle] = useState(profiles[0]?.handle ?? "");
  const [boost, setBoost] = useState<BoostFilter>("all");
  const [filteredVideos, setFilteredVideos] = useState<FilteredVideo[] | undefined>(undefined);
  const profile = profiles.find((p) => p.handle === activeHandle) ?? profiles[0];

  // Reset shared filtered list when user switches handle so the hero falls
  // back to server data briefly instead of showing stale stats from the
  // previous handle.
  useEffect(() => {
    setFilteredVideos(undefined);
  }, [activeHandle]);

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

      <HeroBlock
        handle={activeHandle}
        boost={boost}
        onBoostChange={setBoost}
        videos={filteredVideos}
      />

      <VideoGrid
        handle={activeHandle}
        boost={boost}
        onFilteredChange={setFilteredVideos}
      />
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
