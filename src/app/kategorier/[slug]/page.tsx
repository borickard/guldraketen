import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { unslugifyCategory, slugifyCategory } from "@/lib/categories";
import { getVisibleCategoryNames } from "@/lib/categoryVisibility";
import SuggestForm from "./SuggestForm";

export const revalidate = 3600;

const PERIOD_DAYS = 90;
const MIN_VIDEOS_FOR_AVG = 3;

interface Entry {
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  followers: number | null;
  avg_er: number | null;
  video_count: number;
  total_views: number;
  posts_per_week: number | null;
}

interface CategoryDetail {
  category: string;
  account_count: number;
  avg_er: number | null;
  entries: Entry[];
}

function fmtCompact(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 10_000) return Math.round(n / 1000) + "k";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return n.toLocaleString("sv-SE");
}

async function fetchDetail(category: string): Promise<CategoryDetail | null> {
  const cutoff = new Date(Date.now() - PERIOD_DAYS * 86400000).toISOString();

  const { data: accounts, error: accErr } = await supabaseAdmin
    .from("accounts")
    .select("handle, display_name, avatar_url, followers")
    .eq("is_active", true)
    .eq("category", category);
  if (accErr) return null;

  const handles = (accounts ?? []).map((a) => a.handle);

  const { data: videos } =
    handles.length === 0
      ? {
          data: [] as {
            handle: string;
            engagement_rate: number | null;
            published_at: string | null;
            views: number | null;
          }[],
        }
      : await supabaseAdmin
          .from("videos")
          .select("handle, engagement_rate, published_at, views")
          .in("handle", handles)
          .or("is_contest.eq.false,contest_approved.eq.true")
          .gte("published_at", cutoff);

  const erByHandle = new Map<string, number[]>();
  const viewsByHandle = new Map<string, number>();
  const tsByHandle = new Map<string, number[]>();

  for (const v of videos ?? []) {
    if (v.engagement_rate != null) {
      const list = erByHandle.get(v.handle) ?? [];
      list.push(Number(v.engagement_rate));
      erByHandle.set(v.handle, list);
    }
    viewsByHandle.set(v.handle, (viewsByHandle.get(v.handle) ?? 0) + (v.views ?? 0));
    if (v.published_at) {
      const ts = tsByHandle.get(v.handle) ?? [];
      ts.push(new Date(v.published_at).getTime());
      tsByHandle.set(v.handle, ts);
    }
  }

  const entries: Entry[] = (accounts ?? []).map((acc) => {
    const ers = erByHandle.get(acc.handle) ?? [];
    const avg_er = ers.length > 0 ? ers.reduce((s, x) => s + x, 0) / ers.length : null;
    const ts = tsByHandle.get(acc.handle) ?? [];
    const spanMs = ts.length >= 2 ? Math.max(...ts) - Math.min(...ts) : 0;
    const weeksSpan = Math.max(spanMs / (7 * 24 * 3600 * 1000), 1);
    const posts_per_week = ers.length > 0 ? ers.length / weeksSpan : null;
    return {
      handle: acc.handle,
      display_name: acc.display_name,
      avatar_url: acc.avatar_url,
      followers: acc.followers,
      avg_er: avg_er != null ? parseFloat(avg_er.toFixed(4)) : null,
      video_count: ers.length,
      total_views: viewsByHandle.get(acc.handle) ?? 0,
      posts_per_week:
        posts_per_week != null ? parseFloat(posts_per_week.toFixed(2)) : null,
    };
  });

  entries.sort((a, b) => (b.avg_er ?? -1) - (a.avg_er ?? -1));

  const qualifying = entries
    .filter((e) => e.avg_er != null && e.video_count >= MIN_VIDEOS_FOR_AVG)
    .map((e) => e.avg_er as number);
  const avg_er =
    qualifying.length > 0
      ? qualifying.reduce((s, x) => s + x, 0) / qualifying.length
      : null;

  return {
    category,
    account_count: entries.length,
    avg_er: avg_er != null ? parseFloat(avg_er.toFixed(4)) : null,
    entries,
  };
}

export async function generateStaticParams() {
  const visible = await getVisibleCategoryNames();
  return visible.map((cat) => ({ slug: slugifyCategory(cat) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = unslugifyCategory(slug);
  if (!category) return { title: "Kategori · Sociala Raketer" };
  return {
    title: `${category} · Sociala Raketer`,
    description: `Topplistan i kategorin ${category}: snitt-engagemang, ledare och möjlighet att föreslå nya konton.`,
  };
}

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = unslugifyCategory(slug);
  if (!category) notFound();

  const visible = await getVisibleCategoryNames();
  if (!visible.includes(category)) notFound();

  const detail = await fetchDetail(category);
  if (!detail) notFound();

  return (
    <>
      <style>{styles}</style>
      <main className="cat-detail-page">
        <div className="cat-detail-wrap">
          <Link href="/kategorier" className="cat-detail-back">
            ← Alla kategorier
          </Link>

          <header className="cat-detail-head">
            <h1 className="cat-detail-title">{detail.category}</h1>
            <p className="cat-detail-lead">
              Baserat på senaste {PERIOD_DAYS} dagarna.
            </p>
            <dl className="cat-detail-stats">
              <div className="cat-detail-stat">
                <dt>Konton</dt>
                <dd>{detail.account_count}</dd>
              </div>
              <div className="cat-detail-stat">
                <dt>Snitt-engagemang</dt>
                <dd>{detail.avg_er != null ? `${detail.avg_er.toFixed(2)}%` : "—"}</dd>
              </div>
            </dl>
          </header>

          {detail.entries.length === 0 ? (
            <div className="cat-detail-empty">
              Inga konton i denna kategori ännu. Föreslå ett nedan.
            </div>
          ) : (
            <section className="cat-leaderboard">
              <div className="cat-lb-row cat-lb-row--head">
                <span className="cat-lb-rank">#</span>
                <span className="cat-lb-name">Konto</span>
                <span className="cat-lb-num">Eng.rate</span>
                <span className="cat-lb-num">Visningar</span>
                <span className="cat-lb-num cat-lb-num--mob-hide">Följare</span>
                <span className="cat-lb-num cat-lb-num--mob-hide">Frekvens</span>
              </div>
              {detail.entries.map((e, idx) => (
                <div key={e.handle} className="cat-lb-row">
                  <span className="cat-lb-rank">{idx + 1}</span>
                  <span className="cat-lb-name">
                    {e.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.avatar_url} alt="" className="cat-lb-avatar" />
                    ) : (
                      <div className="cat-lb-avatar cat-lb-avatar--placeholder" />
                    )}
                    <span className="cat-lb-name-text">
                      <span className="cat-lb-display">
                        {e.display_name ?? `@${e.handle}`}
                      </span>
                      <span className="cat-lb-handle">@{e.handle}</span>
                    </span>
                  </span>
                  <span className="cat-lb-num">
                    {e.avg_er != null ? `${e.avg_er.toFixed(2)}%` : "—"}
                  </span>
                  <span className="cat-lb-num">{fmtCompact(e.total_views)}</span>
                  <span className="cat-lb-num cat-lb-num--mob-hide">
                    {fmtCompact(e.followers)}
                  </span>
                  <span className="cat-lb-num cat-lb-num--mob-hide">
                    {e.posts_per_week != null
                      ? e.posts_per_week >= 1
                        ? `${e.posts_per_week.toFixed(1)}/v`
                        : `${(e.posts_per_week * 4.33).toFixed(1)}/mån`
                      : "—"}
                  </span>
                </div>
              ))}
            </section>
          )}

          <div className="cat-detail-suggest">
            <SuggestForm category={detail.category} />
          </div>
        </div>
      </main>
    </>
  );
}

const styles = `
  .cat-detail-page {
    background: #EBE7E2;
    min-height: 100vh;
    color: #1C1B19;
    font-family: 'Barlow', sans-serif;
  }

  .cat-detail-wrap {
    max-width: 760px;
    margin: 0 auto;
    padding: 100px 1.5rem 4rem;
  }

  .cat-detail-back {
    display: inline-block;
    font-size: 12px;
    color: rgba(28,27,25,0.55);
    text-decoration: none;
    margin-bottom: 1.5rem;
    letter-spacing: 0.03em;
  }

  .cat-detail-back:hover { color: #1C1B19; }

  .cat-detail-head { margin-bottom: 2.2rem; }

  .cat-detail-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: clamp(2rem, 5vw, 3rem);
    font-weight: 700;
    line-height: 1;
    margin-bottom: 0.45rem;
  }

  .cat-detail-lead {
    font-size: 13px;
    color: rgba(28,27,25,0.6);
    margin-bottom: 1.1rem;
  }

  .cat-detail-stats {
    display: flex;
    gap: 2rem;
    margin: 0;
    flex-wrap: wrap;
  }

  .cat-detail-stat {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin: 0;
  }

  .cat-detail-stat dt {
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(28,27,25,0.55);
  }

  .cat-detail-stat dd {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.6rem;
    font-weight: 700;
    line-height: 1;
    margin: 0;
  }

  .cat-detail-empty {
    background: #E2DDD7;
    border: 1px solid rgba(28,27,25,0.1);
    border-radius: 4px;
    padding: 2rem;
    font-size: 14px;
    color: rgba(28,27,25,0.7);
    text-align: center;
    margin-bottom: 2.5rem;
  }

  .cat-leaderboard {
    background: #fff;
    border: 1px solid rgba(28,27,25,0.1);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 2.5rem;
  }

  .cat-lb-row {
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr) 80px 80px 80px 80px;
    align-items: center;
    gap: 0.8rem;
    padding: 0.65rem 1rem;
    border-bottom: 1px solid rgba(28,27,25,0.07);
    text-decoration: none;
    color: #1C1B19;
  }

  @media (max-width: 600px) {
    .cat-lb-row { grid-template-columns: 28px minmax(0, 1fr) 72px 72px; gap: 0.5rem; padding: 0.55rem 0.8rem; }
    .cat-lb-num--mob-hide { display: none; }
  }

  .cat-lb-row:last-child { border-bottom: 0; }

  .cat-lb-row--head {
    background: rgba(28,27,25,0.04);
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(28,27,25,0.55);
    padding-top: 0.55rem;
    padding-bottom: 0.55rem;
  }

  .cat-lb-rank {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 15px;
    color: rgba(28,27,25,0.5);
    text-align: center;
  }

  .cat-lb-row--head .cat-lb-rank { text-align: center; }

  .cat-lb-name {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    min-width: 0;
  }

  .cat-lb-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .cat-lb-avatar--placeholder { background: rgba(28,27,25,0.1); }

  .cat-lb-name-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .cat-lb-display {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 16px;
    line-height: 1.1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cat-lb-handle {
    font-size: 11px;
    color: rgba(28,27,25,0.55);
  }

  .cat-lb-num {
    font-family: 'Barlow', sans-serif;
    font-size: 13px;
    font-weight: 600;
    text-align: right;
    color: #1C1B19;
  }

  .cat-lb-row--head .cat-lb-num { font-weight: 500; }

  .cat-detail-suggest {
    margin-top: 1rem;
  }
`;
