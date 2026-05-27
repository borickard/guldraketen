"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import type { HofVideo, HofGroup } from "@/app/api/tidigare-raketer/route";

type Scope = "week" | "month" | "all";
type SortKey = "er" | "likes" | "comments" | "shares" | "collects" | "views" | "newest";
type Filter = "all" | "organic" | "boosted";

const SCOPES: { key: Scope; label: string }[] = [
  { key: "week", label: "Per vecka" },
  { key: "month", label: "Per månad" },
  { key: "all", label: "Sedan start" },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "er", label: "Eng.rate" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Kommentarer" },
  { key: "shares", label: "Delningar" },
  { key: "collects", label: "Favoriter" },
  { key: "views", label: "Visningar" },
  { key: "newest", label: "Nyaste" },
];

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Alla" },
  { key: "organic", label: "Organisk" },
  { key: "boosted", label: "Boostad" },
];

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return Math.round(n / 1_000) + "K";
  return String(n);
}

function fmtFullDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function rankBg(rank: number): string {
  if (rank === 1) return "#C8962A";
  if (rank === 2) return "#8A9299";
  if (rank === 3) return "#96614A";
  return "rgba(28,27,25,0.75)";
}

function rankColor(rank: number): string {
  if (rank === 1) return "#C8962A";
  if (rank === 2) return "#8A9299";
  if (rank === 3) return "#96614A";
  return "#EBE7E2";
}

function HeartIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
    </svg>
  );
}
function CommentIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3c-4.97 0-9 3.186-9 7.115 0 2.055.999 3.898 2.604 5.207-.141.994-.671 2.716-2.604 3.678 2.132-.142 4.658-1.113 5.922-2.203C9.883 16.943 10.925 17 12 17c4.97 0 9-3.186 9-7.115C21 6.186 16.97 3 12 3z" />
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 17 20 12 15 7" />
      <path d="M4 18v-2a4 4 0 014-4h12" />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function BookmarkIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function HofCard({ entry }: { entry: HofVideo }) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="gr-vc gr-hof-row-card">
      <a
        href={entry.video.video_url}
        target="_blank"
        rel="noopener noreferrer"
        className="gr-thumb gr-hof-row-thumb"
      >
        {entry.video.thumbnail_url && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.video.thumbnail_url}
            alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, color: "rgba(28,27,25,0.12)" }}>
              {entry.displayName[0]}
            </span>
          </div>
        )}
        <div className="gr-thumb-stats">
          <span><HeartIcon />{fmt(entry.video.likes)}</span>
          <span><CommentIcon />{fmt(entry.video.comments)}</span>
          <span><ShareIcon />{fmt(entry.video.shares)}</span>
          {entry.video.collect_count != null && (
            <span><BookmarkIcon />{fmt(entry.video.collect_count)}</span>
          )}
          <span><EyeIcon />{fmt(entry.video.views)}</span>
        </div>
        <span className="gr-thumb-er" style={{ color: rankColor(entry.rank) }}>
          {entry.video.engagement_rate.toFixed(2)}%
        </span>
        <span className="gr-thumb-best" style={{ background: rankBg(entry.rank) }}>
          #{entry.rank}
        </span>
        {entry.video.is_ad === true && (
          <span className="gr-hof-boost-badge">Boostad</span>
        )}
      </a>
      <div className="gr-vid-info">
        <a href={`/konto/${entry.handle}`} className="gr-rk-vk-name">
          {entry.displayName}
        </a>
        <p className="gr-hof-card-date">{fmtFullDate(entry.video.published_at)}</p>
      </div>
    </div>
  );
}

function GroupRow({ videos, groupKey }: { videos: HofVideo[]; groupKey: string }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(false);
  const [atStart, setAtStart] = useState(true);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    el.scrollLeft = 0;
    setAtEnd(el.scrollWidth <= el.clientWidth + 24);
    setAtStart(true);
  }, [videos]);

  function onScroll() {
    const el = rowRef.current;
    if (!el) return;
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 24);
    setAtStart(el.scrollLeft <= 24);
  }

  function scrollRight() {
    const el = rowRef.current;
    if (!el) return;
    el.scrollBy({ left: el.clientWidth * 0.7, behavior: "smooth" });
  }

  function scrollLeft() {
    const el = rowRef.current;
    if (!el) return;
    el.scrollBy({ left: -el.clientWidth * 0.7, behavior: "smooth" });
  }

  return (
    <div className={`gr-hof-week-scroll-wrap${atStart ? "" : " gr-hof-week-scroll-wrap--scrolled"}`}>
      <div className="gr-hof-week-row" ref={rowRef} onScroll={onScroll}>
        {videos.map((entry) => (
          <HofCard key={`${groupKey}-${entry.rank}-${entry.handle}`} entry={entry} />
        ))}
      </div>
      {!atStart && (
        <button className="gr-hof-week-arrow gr-hof-week-arrow--left" onClick={scrollLeft} aria-label="Scrolla vänster">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      {!atEnd && (
        <button className="gr-hof-week-arrow" onClick={scrollRight} aria-label="Scrolla höger">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}
    </div>
  );
}

function HallOfFameInner() {
  const [groups, setGroups] = useState<HofGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCat, setSelectedCat] = useState("");
  const [scope, setScope] = useState<Scope>("week");
  const [sort, setSort] = useState<SortKey>("er");
  const [filter, setFilter] = useState<Filter>("all");
  const [urlReady, setUrlReady] = useState(false);
  const ALL_TIME_PAGE = 24;
  const [allTimeLimit, setAllTimeLimit] = useState(ALL_TIME_PAGE);

  // Reset pagination whenever the underlying view changes.
  useEffect(() => {
    setAllTimeLimit(ALL_TIME_PAGE);
  }, [scope, sort, filter, selectedCat]);

  // Read URL params on mount so refreshes / shared links restore the view.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const s = p.get("scope");
    if (s === "week" || s === "month" || s === "all") setScope(s);
    const so = p.get("sort");
    if (so && ["er","likes","comments","shares","collects","views","newest"].includes(so)) {
      setSort(so as SortKey);
    }
    const f = p.get("filter");
    if (f === "all" || f === "organic" || f === "boosted") setFilter(f);
    const cat = p.get("category");
    if (cat) setSelectedCat(cat);
    setUrlReady(true);
  }, []);

  // Write URL params back on state change (after initial read).
  useEffect(() => {
    if (!urlReady) return;
    const p = new URLSearchParams();
    if (scope !== "week") p.set("scope", scope);
    if (sort !== "er") p.set("sort", sort);
    if (filter !== "all") p.set("filter", filter);
    if (selectedCat) p.set("category", selectedCat);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [scope, sort, filter, selectedCat, urlReady]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ scope, sort, filter });
    if (selectedCat) params.set("category", selectedCat);
    fetch(`/api/tidigare-raketer?${params}`)
      .then((r) => r.json())
      .then((d) => { setGroups(Array.isArray(d) ? d : []); setLoading(false); });
  }, [selectedCat, scope, sort, filter]);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then(setCategories);
  }, []);

  return (
    <main className="gr-hof-page gr-page">
      <div className="gr-hof-hdr">
        <h1 className="gr-page-title">Hall of Fame</h1>
      </div>

      <div className="gr-hof-controls">
        <div className="gr-hof-control-row">
          <span className="gr-hof-control-label">Gruppera</span>
          <div className="gr-hof-pills gr-hof-pills--segment">
            {SCOPES.map((s) => (
              <button
                key={s.key}
                className={"gr-hof-pill" + (scope === s.key ? " active" : "")}
                onClick={() => setScope(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="gr-hof-pills gr-hof-pills--segment">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={"gr-hof-pill" + (filter === f.key ? " active" : "")}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          {categories.length > 0 && (
            <select
              className="gr-calc-cat-select gr-hof-cat-select"
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
            >
              <option value="">Alla kategorier</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>
        <div className="gr-hof-control-row">
          <span className="gr-hof-control-label">Sortera på</span>
          <div className="gr-hof-pills">
            {SORTS.map((s) => (
              <button
                key={s.key}
                className={"gr-hof-pill gr-hof-pill--sort" + (sort === s.key ? " active" : "")}
                onClick={() => setSort(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="gr-hof-loading">Laddar…</div>
      ) : groups.length === 0 ? (
        <div className="gr-hof-loading">Inga raketer att visa.</div>
      ) : scope === "all" ? (
        (() => {
          const all = groups[0]?.videos ?? [];
          const shown = all.slice(0, allTimeLimit);
          const hasMore = allTimeLimit < all.length;
          return (
            <div className="gr-hof-week">
              <span className="gr-hof-week-label">{groups[0]?.label}</span>
              <div className="gr-hof-all-grid">
                {shown.map((entry) => (
                  <HofCard key={`all-${entry.rank}-${entry.handle}`} entry={entry} />
                ))}
              </div>
              {hasMore && (
                <div className="gr-hof-load-more-wrap">
                  <button
                    className="gr-hof-load-more"
                    onClick={() => setAllTimeLimit((n) => n + ALL_TIME_PAGE)}
                  >
                    Ladda mer
                  </button>
                </div>
              )}
            </div>
          );
        })()
      ) : (
        groups.map((group) => (
          <div key={group.key} className="gr-hof-week">
            <span className="gr-hof-week-label">{group.label}</span>
            <GroupRow videos={group.videos} groupKey={group.key} />
          </div>
        ))
      )}
    </main>
  );
}

export default function HallOfFamePage() {
  return (
    <Suspense>
      <HallOfFameInner />
    </Suspense>
  );
}
