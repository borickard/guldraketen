"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Rocket, Eye, ThumbsUp, MessageCircle, Share2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Video {
  id: string;
  handle: string;
  video_url: string;
  published_at: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
  thumbnail_url: string | null;
  caption: string | null;
  last_updated: string;
  accounts: { followers: number; display_name?: string | null } | null;
}

type SortKey = "engagement_rate" | "views" | "likes" | "comments" | "shares";
type SizeFilter = "all" | "small" | "medium" | "large";
type ViewsFilter = "all" | "under10k" | "10k100k" | "100k1m" | "over1m";

function accountSize(followers: number): SizeFilter {
  if (followers < 10_000) return "small";
  if (followers < 100_000) return "medium";
  return "large";
}

function viewsRange(views: number): ViewsFilter {
  if (views < 10_000) return "under10k";
  if (views < 100_000) return "10k100k";
  if (views < 1_000_000) return "100k1m";
  return "over1m";
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function displayName(video: Video): string {
  return video.accounts?.display_name || video.handle;
}

function tiktokEmbedId(url: string): string | null {
  const m = url.match(/\/video\/(\d+)/);
  return m ? m[1] : null;
}

function formatWeek(w: string): string {
  const [year, week] = w.split("-W");
  return `Vecka ${parseInt(week)}, ${year}`;
}

function rowClass(rank: number): string {
  if (rank === 1) return "video-row video-row--top1";
  if (rank === 2) return "video-row video-row--top2";
  if (rank === 3) return "video-row video-row--top3";
  return "video-row video-row--rest";
}

// ─── Stat icon ────────────────────────────────────────────────────────────────

function StatIcon({ col }: { col: SortKey }) {
  const props = { size: 11, strokeWidth: 1.75 };
  if (col === "engagement_rate") return <Rocket {...props} />;
  if (col === "views") return <Eye {...props} />;
  if (col === "likes") return <ThumbsUp {...props} />;
  if (col === "comments") return <MessageCircle {...props} />;
  if (col === "shares") return <Share2 {...props} />;
  return null;
}

// ─── ShareButton ─────────────────────────────────────────────────────────────

function buildShareText(video: Video, rank: number, shareUrl: string): string {
  const views = fmt(video.views ?? 0);
  const likes = fmt(video.likes ?? 0);
  const comments = fmt(video.comments ?? 0);
  const shares = fmt(video.shares ?? 0);
  const er = video.engagement_rate != null ? video.engagement_rate.toFixed(2) + "%" : "–";
  const ordinal = rank === 1 ? "🥇 1:a" : rank === 2 ? "🥈 2:a" : "🥉 3:e";

  return `${ordinal} plats på Guldraketen den här veckan: @${video.handle}

📊 ${er} engagemangsgrad
👁 ${views} visningar · 👍 ${likes} likes · 💬 ${comments} kommentarer · 🔁 ${shares} delningar

Guldraketen rankar svenska företagskonton på TikTok efter äkta engagemang – där delningar väger tyngst.
👉 ${shareUrl}`;
}

function ShareButton({ video, rank, week }: { video: Video; rank: number; week: string }) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `https://guldraketen.vercel.app/${week}/top${rank}`;
  const text = buildShareText(video, rank, shareUrl);
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;

  function handleShare() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
    setTimeout(() => window.open(linkedinUrl, "_blank"), 300);
  }

  return (
    <button
      className={`share-btn${copied ? " share-btn--copied" : ""}`}
      onClick={handleShare}
      title="Kopierar text till urklipp och öppnar LinkedIn"
    >
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ display: "inline-block", verticalAlign: "middle" }}>
        <rect x="0" y="3.5" width="2.5" height="7.5" fill="currentColor" />
        <circle cx="1.25" cy="1.25" r="1.25" fill="currentColor" />
        <path d="M4 3.5h2.3v1s.7-1.2 2.2-1.2c1.8 0 2.5 1.2 2.5 3v4.2H8.5V7c0-1-.3-1.7-1.1-1.7-.9 0-1.2.6-1.2 1.7v4H4V3.5z" fill="currentColor" />
      </svg>
      {copied ? "Kopierat!" : "Dela"}
    </button>
  );
}

// ─── HeroSection ─────────────────────────────────────────────────────────────

function HeroSection({ week }: { week: string }) {
  const [top3, setTop3] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!week) return;
    setLoading(true);
    fetch(`/api/top3?week=${week}`)
      .then((r) => r.json())
      .then((data) => { setTop3(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [week]);

  if (loading) return <div className="hero-loading">Laddar…</div>;
  if (!top3.length) return null;

  const weekLabel = (() => {
    const [y, w] = week.split("-W");
    return `Vecka ${parseInt(w)}, ${y}`;
  })();

  return (
    <section className="hero-section">
      <div className="hero-week-label">{weekLabel} · Topp 3</div>
      <div className="hero-podium">
        {top3.map((video, i) => {
          const rank = i + 1;
          const er = video.engagement_rate != null ? video.engagement_rate.toFixed(2) + "%" : "–";
          return (
            <div key={video.id} className={`hero-card hero-card--${rank}`}>
              <button className="hero-thumb" onClick={() => window.open(video.video_url, "_blank")} aria-label={`Se video av ${displayName(video)}`}>
                {video.thumbnail_url
                  ? <img src={video.thumbnail_url} alt={displayName(video)} />
                  : <div className="hero-thumb-placeholder" />
                }
                <div className="hero-rank-badge">{rank}</div>
                <div className="hero-play">
                  <svg width="8" height="10" viewBox="0 0 8 10"><polygon points="1,1 7,5 1,9" fill="#fff" /></svg>
                </div>
              </button>
              <div className="hero-card-body">
                <a className="hero-handle" href={`https://www.tiktok.com/@${video.handle}`} target="_blank" rel="noopener noreferrer">
                  {displayName(video)}
                </a>
                <div className="hero-er">
                  <Rocket size={11} strokeWidth={1.75} />
                  <span>{er}</span>
                  <span className="hero-er-label">eng.rate</span>
                </div>
                <div className="hero-card-actions">
                  <ShareButton video={video} rank={rank} week={week} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── VideoModal ───────────────────────────────────────────────────────────────

function VideoModal({ video, onClose }: { video: Video; onClose: () => void }) {
  const embedId = tiktokEmbedId(video.video_url);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handler); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-handle">{displayName(video)}</span>
          <button className="modal-close" onClick={onClose} aria-label="Stäng">×</button>
        </div>
        {embedId
          ? <iframe src={`https://www.tiktok.com/embed/v2/${embedId}`} className="modal-iframe" allowFullScreen allow="autoplay" scrolling="no" />
          : <div className="modal-fallback"><a href={video.video_url} target="_blank" rel="noopener noreferrer">Öppna på TikTok →</a></div>
        }
      </div>
    </div>
  );
}

// ─── SortableHeader ───────────────────────────────────────────────────────────

const ER_TOOLTIP = "Viktad engagemangsgrad: delningar väger tyngst (×10), kommentarer näst (×5), sedan likes (×1). Delningar kräver mest av tittaren – att vilja visa videon för sin närmsta krets. Formel: (likes + comments×5 + shares×10) / views × 100";

function SortableHeader({ col, label, active, onSort }: {
  col: SortKey; label: string; active: boolean; onSort: (col: SortKey) => void;
}) {
  const isER = col === "engagement_rate";
  return (
    <span
      className={`hcell col-stat sortable${active ? " hcell--active" : ""}`}
      onClick={() => onSort(col)}
      title={isER ? ER_TOOLTIP : undefined}
    >
      {label}{" "}
      <span className="sort-icon">
        {active
          ? <svg width="7" height="5" viewBox="0 0 7 5"><polygon points="0,0 7,0 3.5,5" fill="currentColor" /></svg>
          : <svg width="7" height="8" viewBox="0 0 7 8"><polygon points="0,3 7,3 3.5,0" fill="currentColor" /><polygon points="0,5 7,5 3.5,8" fill="currentColor" /></svg>
        }
      </span>
    </span>
  );
}

// ─── FilterTabs ───────────────────────────────────────────────────────────────

function FilterTabs<T extends string>({ options, value, onChange }: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="filter-tabs">
      {options.map((o) => (
        <button
          key={o.key}
          className={`filter-tab${value === o.key ? " filter-tab--on" : ""}`}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── VideoRow ─────────────────────────────────────────────────────────────────

function VideoRow({ video, rank, sort, onThumb, week }: {
  video: Video; rank: number; sort: SortKey; onThumb: () => void; week: string;
}) {
  const followers = video.accounts?.followers ?? 0;

  const allStats: { key: SortKey; label: string; value: string }[] = [
    { key: "engagement_rate", label: "Eng.rate", value: video.engagement_rate != null ? video.engagement_rate.toFixed(2) + "%" : "–" },
    { key: "views", label: "Views", value: fmt(video.views ?? 0) },
    { key: "likes", label: "Likes", value: fmt(video.likes ?? 0) },
    { key: "comments", label: "Comments", value: fmt(video.comments ?? 0) },
    { key: "shares", label: "Shares", value: fmt(video.shares ?? 0) },
  ];

  const mobileStats = allStats; // visa alla inkl. eng.rate på mobil

  return (
    <div className={rowClass(rank)}>
      {/* ── Desktop: rank ── */}
      <div className="rcell col-rank desktop-only">
        <span className="rank-num">{rank}</span>
      </div>

      {/* ── Thumbnail (both) ── */}
      <button className="thumb-cell" onClick={onThumb} aria-label="Visa video">
        <div className="thumb-sq">
          {video.thumbnail_url
            ? <Image src={video.thumbnail_url} alt={`@${video.handle}`} fill sizes="150px" style={{ objectFit: "cover", objectPosition: "center top" }} />
            : <div style={{ width: "100%", height: "100%", background: "var(--bg2)" }} />
          }
          <div className="thumb-play-sq">
            <svg width="8" height="10" viewBox="0 0 8 10"><polygon points="1,1 7,5 1,9" fill="#fff" /></svg>
          </div>
        </div>
      </button>

      {/* ── Desktop: name + stats ── */}
      <div className="rcell col-name grow desktop-only">
        <div className="name-inner">
          <div className="handle-row">
            <a className="handle" href={`https://www.tiktok.com/@${video.handle}`} target="_blank" rel="noopener noreferrer">
              {displayName(video)}
            </a>
            <a className="tiktok-link" href={video.video_url} target="_blank" rel="noopener noreferrer" aria-label="Öppna på TikTok">
              <svg width="9" height="9" viewBox="0 0 9 9" style={{ display: "inline-block", verticalAlign: "middle" }}>
                <path d="M1 8L8 1M8 1H3M8 1V6" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </a>
            <ShareButton video={video} rank={rank} week={week} />
          </div>
          {video.caption && <div className="caption-row">{video.caption}</div>}
          <div className="date-row">
            {followers > 0 && `${fmt(followers)} followers · `}
            {new Date(video.published_at).toLocaleDateString("sv-SE")}
          </div>
        </div>
      </div>

      {allStats.map((s) => (
        <div
          key={s.key}
          className="rcell col-stat desktop-only"
          title={s.key === "engagement_rate" ? ER_TOOLTIP : undefined}
        >
          <div className="stat-inline">
            <span className="stat-icon"><StatIcon col={s.key} /></span>
            <span className={`stat-val${sort === s.key ? " stat-val--hi" : ""}`}>{s.value}</span>
          </div>
        </div>
      ))}

      {/* ── Mobile: info (flex sibling of thumb) ── */}
      <div className="mobile-info-cell">
        <div className="mobile-rank">{rank}</div>
        <div className="mobile-text">
          <div className="handle-row">
            <a className="handle" href={`https://www.tiktok.com/@${video.handle}`} target="_blank" rel="noopener noreferrer">
              {displayName(video)}
            </a>
            <a className="tiktok-link" href={video.video_url} target="_blank" rel="noopener noreferrer" aria-label="Öppna på TikTok">
              <svg width="9" height="9" viewBox="0 0 9 9" style={{ display: "inline-block", verticalAlign: "middle" }}>
                <path d="M1 8L8 1M8 1H3M8 1V6" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </a>
            <ShareButton video={video} rank={rank} week={week} />
          </div>
          {video.caption && <div className="caption-row">{video.caption}</div>}
          <div className="date-row">
            {followers > 0 && `${fmt(followers)} followers · `}
            {new Date(video.published_at).toLocaleDateString("sv-SE")}
          </div>
        </div>
      </div>

      {/* ── Mobile: stats row – spans full width via flex-wrap ── */}
      <div className="mobile-stats-row">
        {mobileStats.map((s) => (
          <div key={s.key} className={`mobile-stat${sort === s.key ? " mobile-stat--hi" : ""}`}>
            <span className="mobile-stat-icon"><StatIcon col={s.key} /></span>
            <span className="mobile-stat-val">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "engagement_rate", label: "Eng.rate" },
  { key: "views", label: "Views" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
];

const SIZE_OPTIONS: { key: SizeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "small", label: "< 10K" },
  { key: "medium", label: "10K–100K" },
  { key: "large", label: "> 100K" },
];

const VIEWS_OPTIONS: { key: ViewsFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "under10k", label: "< 10K" },
  { key: "10k100k", label: "10K–100K" },
  { key: "100k1m", label: "100K–1M" },
  { key: "over1m", label: "> 1M" },
];

// ─── Inner page ───────────────────────────────────────────────────────────────

function HomePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [weeks, setWeeks] = useState<string[]>([]);
  const [weekState, setWeekState] = useState<string>("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [loadingWeeks, setLoadingWeeks] = useState(true);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<Video | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [sortState, setSortState] = useState<SortKey>(
    (searchParams.get("sort") as SortKey) || "engagement_rate"
  );
  const [sizeState, setSizeState] = useState<SizeFilter>(
    (searchParams.get("size") as SizeFilter) || "all"
  );
  const [viewsState, setViewsState] = useState<ViewsFilter>(
    (searchParams.get("views") as ViewsFilter) || "all"
  );

  const hasActiveFilters = sizeState !== "all" || viewsState !== "all";

  function updateURL(patch: { week?: string; sort?: SortKey; size?: SizeFilter; views?: ViewsFilter }) {
    const p = new URLSearchParams(searchParams.toString());
    if (patch.week !== undefined) p.set("week", patch.week);
    if (patch.sort !== undefined) p.set("sort", patch.sort);
    if (patch.size !== undefined) p.set("size", patch.size);
    if (patch.views !== undefined) p.set("views", patch.views);
    router.replace(`?${p.toString()}`, { scroll: false });
  }

  function setWeek(w: string) { setWeekState(w); updateURL({ week: w }); }
  function setSort(s: SortKey) {
    const next = s === sortState ? "engagement_rate" : s;
    setSortState(next); updateURL({ sort: next });
  }
  function setSize(s: SizeFilter) {
    const next = s === sizeState ? "all" : s;
    setSizeState(next); updateURL({ size: next });
  }
  function setViews(v: ViewsFilter) {
    const next = v === viewsState ? "all" : v;
    setViewsState(next); updateURL({ views: next });
  }

  useEffect(() => {
    fetch("/api/weeks")
      .then((r) => r.json())
      .then((data: string[]) => {
        setWeeks(data);
        const urlWeek = searchParams.get("week");
        const initial = urlWeek && data.includes(urlWeek) ? urlWeek : data[0];
        if (initial) {
          setWeekState(initial);
          if (!urlWeek) {
            const p = new URLSearchParams(searchParams.toString());
            p.set("week", initial);
            router.replace(`?${p.toString()}`, { scroll: false });
          }
        }
        setLoadingWeeks(false);
      })
      .catch(() => { setError("Kunde inte ladda veckor."); setLoadingWeeks(false); });
  }, []);

  useEffect(() => {
    if (!weekState) return;
    setLoadingVideos(true);
    setError("");
    fetch(`/api/videos?week=${weekState}`)
      .then((r) => r.json())
      .then((data) => { setVideos(Array.isArray(data) ? data : []); setLoadingVideos(false); })
      .catch(() => { setError("Kunde inte ladda videos."); setLoadingVideos(false); });
  }, [weekState]);

  const currentWeekIndex = weeks.indexOf(weekState);

  const sorted = useMemo(() => {
    return [...videos]
      .filter((v) => sizeState === "all" || accountSize(v.accounts?.followers ?? 0) === sizeState)
      .filter((v) => viewsState === "all" || viewsRange(v.views ?? 0) === viewsState)
      .sort((a, b) => (b[sortState] ?? 0) - (a[sortState] ?? 0));
  }, [videos, sortState, sizeState, viewsState]);

  const loading = loadingWeeks || loadingVideos;

  return (
    <main className="page-root">
      {modal && <VideoModal video={modal} onClose={() => setModal(null)} />}

      <header className="header">
        <div className="header-inner">
          <h1 className="wordmark"><span className="wordmark-gold">Guld</span>raketen</h1>
          <p className="header-desc">Sveriges mest engagerande TikTok-konton · 2026</p>
        </div>
        <div className="header-rule" />
      </header>

      {weekState && <HeroSection week={weekState} />}

      <div className="os-window">
        <div className="os-titlebar">
          <div className="os-wbtn">×</div>
          <div className="os-wbtn">□</div>
          <div className="os-titlebar-title">◆ Topplista</div>
          <div className="os-wbtn">?</div>
        </div>

        <div className="os-body">
          <div className="top-controls">
            <div className="week-row">
              <div className="week-select-wrap">
                <select
                  className="week-select"
                  value={weekState}
                  onChange={(e) => setWeek(e.target.value)}
                  disabled={weeks.length === 0}
                >
                  {weeks.map((w) => <option key={w} value={w}>{formatWeek(w)}</option>)}
                  {weeks.length === 0 && <option>Laddar…</option>}
                </select>
                <span className="week-select-arrow">▼</span>
              </div>
              <div className="nav-group">
                <button className="nav-btn" disabled={currentWeekIndex >= weeks.length - 1} onClick={() => setWeek(weeks[currentWeekIndex + 1])}>←</button>
                <button className="nav-btn" disabled={currentWeekIndex <= 0} onClick={() => setWeek(weeks[currentWeekIndex - 1])}>→</button>
              </div>
              <button
                className={`filter-toggle mobile-only${hasActiveFilters ? " filter-toggle--active" : ""}`}
                onClick={() => setShowFilters(!showFilters)}
              >
                <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
                  <rect x="0" y="0" width="13" height="1.5" fill="currentColor" />
                  <rect x="2" y="4" width="9" height="1.5" fill="currentColor" />
                  <rect x="4" y="8" width="5" height="1.5" fill="currentColor" />
                </svg>
                Filters{hasActiveFilters ? " ●" : ""}
              </button>
            </div>

            <div className="filter-col desktop-only">
              <div className="filter-group">
                <span className="filter-label">Followers</span>
                <FilterTabs options={SIZE_OPTIONS} value={sizeState} onChange={setSize} />
              </div>
              <div className="filter-group">
                <span className="filter-label">Views</span>
                <FilterTabs options={VIEWS_OPTIONS} value={viewsState} onChange={setViews} />
              </div>
            </div>

            <div className="mobile-sort-row mobile-only">
              <span className="filter-label">Sort by</span>
              <FilterTabs options={SORT_OPTIONS} value={sortState} onChange={setSort} />
            </div>

            {showFilters && (
              <div className="filter-col mobile-only">
                <div className="filter-group">
                  <span className="filter-label">Followers</span>
                  <FilterTabs options={SIZE_OPTIONS} value={sizeState} onChange={setSize} />
                </div>
                <div className="filter-group">
                  <span className="filter-label">Views</span>
                  <FilterTabs options={VIEWS_OPTIONS} value={viewsState} onChange={setViews} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="os-inset">
          <div className="list-hdr desktop-only">
            <span className="hcell col-rank">#</span>
            <span className="hcell col-thumb">Video</span>
            <span className="hcell col-name grow">Account</span>
            <SortableHeader col="engagement_rate" label="Eng.rate" active={sortState === "engagement_rate"} onSort={setSort} />
            <SortableHeader col="views" label="Views" active={sortState === "views"} onSort={setSort} />
            <SortableHeader col="likes" label="Likes" active={sortState === "likes"} onSort={setSort} />
            <SortableHeader col="comments" label="Comm." active={sortState === "comments"} onSort={setSort} />
            <SortableHeader col="shares" label="Shares" active={sortState === "shares"} onSort={setSort} />
          </div>

          {loading && <p className="state">Laddar…</p>}
          {error && <p className="state state--err">{error}</p>}
          {!loading && !error && sorted.length === 0 && <p className="state">Inga videos för den här veckan.</p>}

          {sorted.map((v, i) => (
            <VideoRow key={v.id} video={v} rank={i + 1} sort={sortState} onThumb={() => setModal(v)} week={weekState} />
          ))}
        </div>

        <div className="os-footer">
          <div className="status-tag">◆ Guldraketen · {weekState ? formatWeek(weekState) : "–"}</div>
          <span className="ctrl-meta">{!loading && !error ? `${sorted.length} videos` : ""}</span>
        </div>
      </div>

      <footer className="page-footer">
        © {new Date().getFullYear()} Guldraketen &nbsp;·&nbsp;
        <a href="/nominera" className="footer-link">Nominera ett konto</a>
      </footer>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageInner />
    </Suspense>
  );
}