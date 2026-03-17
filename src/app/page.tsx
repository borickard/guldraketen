"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

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
  accounts: { followers: number } | null;
}

type SortKey = "engagement_rate" | "views" | "likes" | "shares";
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
          <span className="modal-handle">@{video.handle}</span>
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

function SortableHeader({ col, label, active, onSort }: {
  col: SortKey; label: string; active: boolean; onSort: (col: SortKey) => void;
}) {
  return (
    <span className={`hcell col-stat sortable${active ? " hcell--active" : ""}`} onClick={() => onSort(col)}>
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

function VideoRow({ video, rank, sort, onThumb }: {
  video: Video; rank: number; sort: SortKey; onThumb: () => void;
}) {
  const followers = video.accounts?.followers ?? 0;
  const stats: { key: SortKey; label: string; value: string }[] = [
    { key: "engagement_rate", label: "Eng.rate", value: video.engagement_rate != null ? video.engagement_rate.toFixed(2) + "%" : "–" },
    { key: "views", label: "Views", value: fmt(video.views ?? 0) },
    { key: "likes", label: "Likes", value: fmt(video.likes ?? 0) },
    { key: "shares", label: "Shares", value: fmt(video.shares ?? 0) },
  ];
  return (
    <div className={rowClass(rank)}>
      <div className="rcell col-rank"><span className="rank-num">{rank}</span></div>
      <button className="thumb-cell" onClick={onThumb} aria-label="Visa video">
        <div className="thumb-sq">
          {video.thumbnail_url
            ? <Image src={video.thumbnail_url} alt={`@${video.handle}`} fill sizes="72px" style={{ objectFit: "cover", objectPosition: "center top" }} />
            : <div style={{ width: "100%", height: "100%", background: "var(--bg2)" }} />
          }
          <div className="thumb-play-sq">
            <svg width="8" height="10" viewBox="0 0 8 10"><polygon points="1,1 7,5 1,9" fill="#fff" /></svg>
          </div>
        </div>
      </button>
      <div className="rcell col-name grow">
        <div className="name-inner">
          <div className="handle-row">
            <a className="handle" href={`https://www.tiktok.com/@${video.handle}`} target="_blank" rel="noopener noreferrer">
              @{video.handle}
            </a>
            <a className="tiktok-link" href={video.video_url} target="_blank" rel="noopener noreferrer" aria-label="Öppna på TikTok">
              <svg width="9" height="9" viewBox="0 0 9 9" style={{ display: "inline-block", verticalAlign: "middle" }}>
                <path d="M1 8L8 1M8 1H3M8 1V6" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </a>
          </div>
          {video.caption && <div className="caption-row">{video.caption}</div>}
          <div className="date-row">
            {followers > 0 && `${fmt(followers)} följare · `}
            {new Date(video.published_at).toLocaleDateString("sv-SE")}
          </div>
        </div>
      </div>
      {stats.map((s) => (
        <div key={s.key} className="rcell col-stat">
          <div className="stat-inner">
            <span className={`stat-val${sort === s.key ? " stat-val--hi" : ""}`}>{s.value}</span>
            <span className="stat-lbl">{s.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SIZE_OPTIONS: { key: SizeFilter; label: string }[] = [
  { key: "all", label: "Alla" },
  { key: "small", label: "< 10K" },
  { key: "medium", label: "10K–100K" },
  { key: "large", label: "> 100K" },
];

const VIEWS_OPTIONS: { key: ViewsFilter; label: string }[] = [
  { key: "all", label: "Alla" },
  { key: "under10k", label: "< 10K" },
  { key: "10k100k", label: "10K–100K" },
  { key: "100k1m", label: "100K–1M" },
  { key: "over1m", label: "> 1M" },
];

// ─── Inner page ───────────────────────────────────────────────────────────────

function HomePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ─── State (declared before any functions that reference them) ─────────────

  const [weeks, setWeeks] = useState<string[]>([]);
  const [weekState, setWeekState] = useState<string>("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [loadingWeeks, setLoadingWeeks] = useState(true);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<Video | null>(null);

  const [sortState, setSortState] = useState<SortKey>(
    (searchParams.get("sort") as SortKey) || "engagement_rate"
  );
  const [sizeState, setSizeState] = useState<SizeFilter>(
    (searchParams.get("size") as SizeFilter) || "all"
  );
  const [viewsState, setViewsState] = useState<ViewsFilter>(
    (searchParams.get("views") as ViewsFilter) || "all"
  );

  // ─── URL sync ──────────────────────────────────────────────────────────────

  function updateURL(patch: { week?: string; sort?: SortKey; size?: SizeFilter; views?: ViewsFilter }) {
    const p = new URLSearchParams(searchParams.toString());
    if (patch.week !== undefined) p.set("week", patch.week);
    if (patch.sort !== undefined) p.set("sort", patch.sort);
    if (patch.size !== undefined) p.set("size", patch.size);
    if (patch.views !== undefined) p.set("views", patch.views);
    router.replace(`?${p.toString()}`, { scroll: false });
  }

  function setWeek(w: string) {
    setWeekState(w);
    updateURL({ week: w });
  }

  function setSort(s: SortKey) {
    const next = s === sortState ? "engagement_rate" : s;
    setSortState(next);
    updateURL({ sort: next });
  }

  function setSize(s: SizeFilter) {
    const next = s === sizeState ? "all" : s;
    setSizeState(next);
    updateURL({ size: next });
  }

  function setViews(v: ViewsFilter) {
    const next = v === viewsState ? "all" : v;
    setViewsState(next);
    updateURL({ views: next });
  }

  // ─── Load weeks ────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/weeks")
      .then((r) => r.json())
      .then((data: string[]) => {
        setWeeks(data);
        const urlWeek = searchParams.get("week");
        const initial = urlWeek && data.includes(urlWeek) ? urlWeek : data[0];
        if (initial) {
          setWeekState(initial);
          if (!urlWeek && initial) {
            const p = new URLSearchParams(searchParams.toString());
            p.set("week", initial);
            router.replace(`?${p.toString()}`, { scroll: false });
          }
        }
        setLoadingWeeks(false);
      })
      .catch(() => { setError("Kunde inte ladda veckor."); setLoadingWeeks(false); });
  }, []);

  // ─── Load videos ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!weekState) return;
    setLoadingVideos(true);
    setError("");
    fetch(`/api/videos?week=${weekState}`)
      .then((r) => r.json())
      .then((data) => { setVideos(Array.isArray(data) ? data : []); setLoadingVideos(false); })
      .catch(() => { setError("Kunde inte ladda videos."); setLoadingVideos(false); });
  }, [weekState]);

  // ─── Derived ───────────────────────────────────────────────────────────────

  const currentWeekIndex = weeks.indexOf(weekState);

  const sorted = useMemo(() => {
    return [...videos]
      .filter((v) => sizeState === "all" || accountSize(v.accounts?.followers ?? 0) === sizeState)
      .filter((v) => viewsState === "all" || viewsRange(v.views ?? 0) === viewsState)
      .sort((a, b) => (b[sortState] ?? 0) - (a[sortState] ?? 0));
  }, [videos, sortState, sizeState, viewsState]);

  const loading = loadingWeeks || loadingVideos;

  // ─── Render ────────────────────────────────────────────────────────────────

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
            </div>

            <div className="filter-col">
              <div className="filter-group">
                <span className="filter-label">Följare</span>
                <FilterTabs options={SIZE_OPTIONS} value={sizeState} onChange={setSize} />
              </div>
              <div className="filter-group">
                <span className="filter-label">Visningar</span>
                <FilterTabs options={VIEWS_OPTIONS} value={viewsState} onChange={setViews} />
              </div>
            </div>
          </div>
        </div>

        <div className="os-inset">
          <div className="list-hdr">
            <span className="hcell col-rank">#</span>
            <span className="hcell col-thumb">Video</span>
            <span className="hcell col-name grow">Konto</span>
            <SortableHeader col="engagement_rate" label="Eng.rate" active={sortState === "engagement_rate"} onSort={setSort} />
            <SortableHeader col="views" label="Views" active={sortState === "views"} onSort={setSort} />
            <SortableHeader col="likes" label="Likes" active={sortState === "likes"} onSort={setSort} />
            <SortableHeader col="shares" label="Shares" active={sortState === "shares"} onSort={setSort} />
          </div>

          {loading && <p className="state">Laddar…</p>}
          {error && <p className="state state--err">{error}</p>}
          {!loading && !error && sorted.length === 0 && <p className="state">Inga videos för den här veckan.</p>}

          {sorted.map((v, i) => (
            <VideoRow key={v.id} video={v} rank={i + 1} sort={sortState} onThumb={() => setModal(v)} />
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

// ─── Page (Suspense wrapper required for useSearchParams) ─────────────────────

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageInner />
    </Suspense>
  );
}