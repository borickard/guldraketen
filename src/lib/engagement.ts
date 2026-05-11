// Engagement-rate calculation. Mirrors the Postgres generated column on
// `videos.engagement_rate`, which is the source of truth for ranking.
//
// Formula v2 (collect_count tracked):
//   (likes + comments*5 + shares*10 + collect_count*5) / views * 100
// Formula v1 (collect_count IS NULL — videos scraped before the bookmark cutoff):
//   (likes + comments*5 + shares*10) / views * 100

export interface EngagementWeights {
    likes: number;
    comments: number;
    shares: number;
    collects: number;
}

export const DEFAULT_WEIGHTS: EngagementWeights = {
    likes: 1,
    comments: 5,
    shares: 10,
    collects: 5,
};

export interface EngagementStats {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    collect_count?: number | null;
}

export function calculateEngagement(
    stats: EngagementStats,
    weights: EngagementWeights = DEFAULT_WEIGHTS
): number {
    if (!stats.views || stats.views <= 0) return 0;
    const base =
        stats.likes * weights.likes +
        stats.comments * weights.comments +
        stats.shares * weights.shares;
    const withCollects =
        stats.collect_count != null
            ? base + stats.collect_count * weights.collects
            : base;
    return (withCollects / stats.views) * 100;
}
