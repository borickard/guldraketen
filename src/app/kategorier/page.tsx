import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { slugifyCategory } from "@/lib/categories";
import { getVisibleCategoryNames } from "@/lib/categoryVisibility";
import Link from "next/link";

export const revalidate = 3600;

const PERIOD_DAYS = 90;
const MIN_VIDEOS_FOR_AVG = 3;
const MAX_AVATARS = 5;

interface AvatarInfo {
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface CategorySummary {
  category: string;
  slug: string;
  account_count: number;
  avg_er: number | null;
  top_account: { handle: string; display_name: string | null; avg_er: number | null } | null;
  avatars: AvatarInfo[];
}

async function fetchSummaries(): Promise<CategorySummary[]> {
  const cutoff = new Date(Date.now() - PERIOD_DAYS * 86400000).toISOString();

  const { data: accounts } = await supabaseAdmin
    .from("accounts")
    .select("handle, display_name, category, avatar_url")
    .eq("is_active", true)
    .not("category", "is", null);

  const handles = (accounts ?? []).map((a) => a.handle);

  const { data: videos } =
    handles.length === 0
      ? { data: [] as { handle: string; engagement_rate: number | null }[] }
      : await supabaseAdmin
          .from("videos")
          .select("handle, engagement_rate")
          .in("handle", handles)
          .or("is_contest.eq.false,contest_approved.eq.true")
          .gte("published_at", cutoff);

  const erByHandle = new Map<string, number[]>();
  for (const v of videos ?? []) {
    if (v.engagement_rate == null) continue;
    const list = erByHandle.get(v.handle) ?? [];
    list.push(Number(v.engagement_rate));
    erByHandle.set(v.handle, list);
  }

  interface Summary {
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
    avg_er: number | null;
    video_count: number;
  }

  const summaries = new Map<string, Summary>();
  for (const acc of accounts ?? []) {
    const ers = erByHandle.get(acc.handle) ?? [];
    const avg_er = ers.length > 0 ? ers.reduce((s, x) => s + x, 0) / ers.length : null;
    summaries.set(acc.handle, {
      handle: acc.handle,
      display_name: acc.display_name,
      avatar_url: acc.avatar_url ?? null,
      avg_er,
      video_count: ers.length,
    });
  }

  const byCategory = new Map<string, Summary[]>();
  for (const acc of accounts ?? []) {
    if (!acc.category) continue;
    const s = summaries.get(acc.handle);
    if (!s) continue;
    const list = byCategory.get(acc.category) ?? [];
    list.push(s);
    byCategory.set(acc.category, list);
  }

  const visible = await getVisibleCategoryNames();
  return visible.map((cat) => {
    const items = byCategory.get(cat) ?? [];
    const qualifying = items.filter(
      (s) => s.avg_er != null && s.video_count >= MIN_VIDEOS_FOR_AVG
    );
    const avg_er =
      qualifying.length > 0
        ? qualifying.reduce((s, x) => s + (x.avg_er ?? 0), 0) / qualifying.length
        : null;
    const top = qualifying.slice().sort((a, b) => (b.avg_er ?? 0) - (a.avg_er ?? 0))[0];

    // Prefer accounts that actually have an avatar, then best ER, for the stack.
    const avatars: AvatarInfo[] = items
      .slice()
      .sort((a, b) => {
        const av = a.avatar_url ? 0 : 1;
        const bv = b.avatar_url ? 0 : 1;
        if (av !== bv) return av - bv;
        return (b.avg_er ?? 0) - (a.avg_er ?? 0);
      })
      .slice(0, MAX_AVATARS)
      .map((s) => ({ handle: s.handle, display_name: s.display_name, avatar_url: s.avatar_url }));

    return {
      category: cat,
      slug: slugifyCategory(cat),
      account_count: items.length,
      avg_er: avg_er != null ? parseFloat(avg_er.toFixed(4)) : null,
      top_account: top
        ? {
            handle: top.handle,
            display_name: top.display_name,
            avg_er: top.avg_er != null ? parseFloat(top.avg_er.toFixed(4)) : null,
          }
        : null,
      avatars,
    };
  });
}

export const metadata = {
  title: "Kategorier · Sociala Raketer",
  description:
    "Utforska svenska företag och organisationer på TikTok kategori för kategori — snitt-engagemang, ledare och föreslå nya konton.",
};

function initials(name: string | null, handle: string): string {
  const base = (name ?? handle).trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export default async function KategorierPage() {
  const summaries = await fetchSummaries();
  return (
    <>
      <style>{styles}</style>
      <main className="cat-list-page">
        <div className="cat-list-wrap">
          <header className="cat-list-head">
            <span className="cat-list-eyebrow">Branscher</span>
            <h1 className="cat-list-title">Kategorier</h1>
            <p className="cat-list-lead">
              Sociala Raketer trackar svenska företag och organisationer på TikTok. Här är hur
              de fördelar sig per bransch — snitt-engagemang baseras på de senaste {PERIOD_DAYS}{" "}
              dagarna.
            </p>
          </header>

          <div className="cat-grid">
            {summaries.map((s) => {
              const extra = s.account_count - s.avatars.length;
              return (
                <Link key={s.slug} href={`/kategorier/${s.slug}`} className="cat-card">
                  <div className="cat-card-top">
                    <div className="cat-avatars">
                      {s.avatars.map((a) =>
                        a.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={a.handle}
                            src={a.avatar_url}
                            alt={a.display_name ?? a.handle}
                            className="cat-avatar"
                            loading="lazy"
                          />
                        ) : (
                          <span key={a.handle} className="cat-avatar cat-avatar--fallback">
                            {initials(a.display_name, a.handle)}
                          </span>
                        )
                      )}
                      {extra > 0 && <span className="cat-avatar cat-avatar--more">+{extra}</span>}
                      {s.avatars.length === 0 && (
                        <span className="cat-avatar cat-avatar--fallback">—</span>
                      )}
                    </div>
                    <span className="cat-card-count">
                      {s.account_count} {s.account_count === 1 ? "konto" : "konton"}
                    </span>
                  </div>

                  <h2 className="cat-card-title">{s.category}</h2>

                  <div className="cat-card-stats">
                    <div className="cat-card-stat cat-card-stat--primary">
                      <dt>Snitt-engagemang</dt>
                      <dd>{s.avg_er != null ? `${s.avg_er.toFixed(2)}%` : "—"}</dd>
                    </div>
                    <div className="cat-card-stat">
                      <dt>I topp</dt>
                      <dd>
                        {s.top_account ? (
                          <>
                            {s.top_account.display_name ?? `@${s.top_account.handle}`}{" "}
                            <span className="cat-card-er">
                              ({s.top_account.avg_er?.toFixed(2)}%)
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                  </div>

                  <span className="cat-card-arrow">Se kategorin →</span>
                </Link>
              );
            })}
          </div>
          <p className="cat-list-foot">
            Gillar du Sociala Raketer?{" "}
            <a href="/stotta" className="cat-list-foot-link">Stötta projektet →</a>
          </p>
        </div>
      </main>
    </>
  );
}

const styles = `
  .cat-list-page {
    background: #EBE7E2;
    min-height: 100vh;
    color: #1C1B19;
    font-family: 'Barlow', sans-serif;
  }

  .cat-list-wrap {
    max-width: 1100px;
    margin: 0 auto;
    padding: 100px 1.5rem 4rem;
  }

  .cat-list-head { margin-bottom: 2.5rem; }

  .cat-list-eyebrow {
    display: inline-block;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #C8962A;
    margin-bottom: 0.5rem;
  }

  .cat-list-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: clamp(2.4rem, 6vw, 3.5rem);
    font-weight: 700;
    line-height: 1;
    margin-bottom: 0.65rem;
    letter-spacing: -0.01em;
  }

  .cat-list-lead {
    font-size: 15px;
    color: rgba(28,27,25,0.65);
    max-width: 620px;
    line-height: 1.55;
  }

  .cat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
  }

  .cat-card {
    position: relative;
    background: #E2DDD7;
    border: 1px solid rgba(28,27,25,0.1);
    padding: 1.4rem 1.4rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    text-decoration: none;
    color: #1C1B19;
    border-radius: 14px;
    overflow: hidden;
    transition: background 0.14s, border-color 0.14s, transform 0.14s, box-shadow 0.14s;
  }

  /* Gold accent bar that grows on hover */
  .cat-card::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: #C8962A;
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.18s ease;
  }

  .cat-card:hover {
    background: #DCD6CF;
    border-color: rgba(28,27,25,0.22);
    transform: translateY(-2px);
    box-shadow: 0 8px 22px rgba(28,27,25,0.1);
  }
  .cat-card:hover::before { transform: scaleX(1); }

  .cat-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .cat-avatars {
    display: flex;
    align-items: center;
  }

  .cat-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 2px solid #E2DDD7;
    object-fit: cover;
    object-position: center;
    margin-left: -11px;
    background: #cfc8c0;
    box-shadow: 0 1px 2px rgba(28,27,25,0.12);
    flex-shrink: 0;
  }
  .cat-card:hover .cat-avatar { border-color: #DCD6CF; }
  .cat-avatar:first-child { margin-left: 0; }

  .cat-avatar--fallback,
  .cat-avatar--more {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.02em;
    color: #1C1B19;
  }
  .cat-avatar--more {
    background: #1C1B19;
    color: #EBE7E2;
    font-size: 12px;
  }

  .cat-card-count {
    font-size: 12px;
    font-weight: 600;
    color: rgba(28,27,25,0.55);
    letter-spacing: 0.02em;
    white-space: nowrap;
  }

  .cat-card-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.7rem;
    font-weight: 700;
    line-height: 1.05;
  }

  .cat-card-stats {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    margin: 0;
    padding-top: 0.2rem;
    border-top: 1px solid rgba(28,27,25,0.1);
  }

  .cat-card-stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .cat-card-stat dt {
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(28,27,25,0.5);
  }

  .cat-card-stat dd {
    font-family: 'Barlow', sans-serif;
    font-size: 15px;
    font-weight: 600;
    color: #1C1B19;
    margin: 0;
  }

  .cat-card-stat--primary dd {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.9rem;
    font-weight: 700;
    line-height: 1;
    color: #C8962A;
  }

  .cat-card-er {
    font-weight: 500;
    color: rgba(28,27,25,0.55);
  }

  .cat-card-arrow {
    margin-top: auto;
    font-size: 12px;
    letter-spacing: 0.04em;
    color: #C8962A;
    font-weight: 700;
    text-transform: uppercase;
  }

  .cat-list-foot {
    text-align: center;
    font-family: 'Barlow', sans-serif;
    font-size: 14px;
    color: rgba(28,27,25,0.55);
    margin: 40px 0 0;
  }
  .cat-list-foot-link { color: #C8962A; font-weight: 700; text-decoration: none; white-space: nowrap; }
  .cat-list-foot-link:hover { text-decoration: underline; }

  @media (max-width: 600px) {
    .cat-list-wrap { padding: 88px 1.1rem 3rem; }
    .cat-grid { grid-template-columns: 1fr; gap: 0.85rem; }
    .cat-card { border-radius: 12px; }
  }
`;
