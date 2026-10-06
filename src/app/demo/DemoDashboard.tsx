"use client";

import { useState } from "react";
import HeroBlock from "../dashboard/components/HeroBlock";
import VideoGrid from "../dashboard/components/VideoGrid";
import { DEMO_VIDEOS, DEMO_HERO } from "./demoData";

type BoostFilter = "all" | "organic" | "boosted";

// Same minimal shape DashboardClient uses to feed the hero its benchmarks.
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

// Reuses the exact real dashboard components (HeroBlock + VideoGrid) so the demo
// mirrors the live dashboard automatically — only the data is demo, and write
// features are hidden via readOnly.
export default function DemoDashboard() {
  const [boost, setBoost] = useState<BoostFilter>("all");
  const [filteredVideos, setFilteredVideos] = useState<FilteredVideo[] | undefined>(undefined);

  return (
    <>
      <HeroBlock
        handle="demokonto"
        boost={boost}
        onBoostChange={setBoost}
        videos={filteredVideos}
        demo={DEMO_HERO}
      />
      <VideoGrid
        handle="demokonto"
        boost={boost}
        onFilteredChange={setFilteredVideos}
        demoVideos={DEMO_VIDEOS}
        readOnly
      />
    </>
  );
}
