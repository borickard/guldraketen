import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CATEGORIES, slugifyCategory } from "@/lib/categories";
import Link from "next/link";

export const revalidate = 3600;

const PERIOD_DAYS = 90;
const MIN_VIDEOS_FOR_AVG = 3;

interface CategorySummary {
  category: string;
  slug: string;
  account_count: number;
  avg_er: number | null;
  top_account: { handle: string; display_name: string | null; avg_er: number | null } | null;
}

async function fetchSummaries(): Promise<CategorySummary[]> {
  const cutoff = new Date(Date.now() - PERIOD_DAYS * 86400000).toISOString();

  const { data: accounts } = await supabaseAdmin
    .from("accounts")
    .select("handle, display_name, category")
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

  return CATEGORIES.map((cat) => {
    const items = byCategory.get(cat) ?? [];
    const qualifying = items.filter(
      (s) => s.avg_er != null && s.video_count >= MIN_VIDEOS_FOR_AVG
    );
    const avg_er =
      qualifying.length > 0
        ? qualifying.reduce((s, x) => s + (x.avg_er ?? 0), 0) / qualifying.length
        : null;
    const top = qualifying.slice().sort((a, b) => (b.avg_er ?? 0) - (a.avg_er ?? 0))[0];
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
    };
  });
}

export const metadata = {
  title: "Kategorier · Sociala Raketer",
  description:
    "Utforska svenska företag och organisationer på TikTok kategori för kategori — snitt-engagemang, ledare och föreslå nya konton.",
};

export default async function KategorierPage() {
  const summaries = await fetchSummaries();
  return (
    <>
      <style>{styles}</style>
      <main className="cat-list-page">
        <div className="cat-list-wrap">
          <header className="cat-list-head">
            <h1 className="cat-list-title">Kategorier</h1>
            <p className="cat-list-lead">
              Sociala Raketer trackar svenska företag och organisationer på TikTok. Här är hur
              de fördelar sig per bransch — snitt-engagemang baseras på senaste {PERIOD_DAYS}{" "}
              dagarna.
            </p>
          </header>

          <div className="cat-grid">
            {summaries.map((s) => (
              <Link key={s.slug} href={`/kategorier/${s.slug}`} className="cat-card">
                <h2 className="cat-card-title">{s.category}</h2>
                <p className="cat-card-count">
                  {s.account_count} {s.account_count === 1 ? "konto" : "konton"} trackas
                </p>
                <dl className="cat-card-stats">
                  <div className="cat-card-stat">
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
                </dl>
                <span className="cat-card-arrow">Se kategorin →</span>
              </Link>
            ))}
          </div>
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

  .cat-list-head { margin-bottom: 2rem; }

  .cat-list-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: clamp(2rem, 5vw, 3rem);
    font-weight: 700;
    line-height: 1;
    margin-bottom: 0.65rem;
  }

  .cat-list-lead {
    font-size: 14px;
    color: rgba(28,27,25,0.65);
    max-width: 640px;
    line-height: 1.5;
  }

  .cat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .cat-card {
    background: #E2DDD7;
    border: 1px solid rgba(28,27,25,0.1);
    padding: 1.4rem 1.4rem 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    text-decoration: none;
    color: #1C1B19;
    transition: background 0.12s, border-color 0.12s, transform 0.12s;
    border-radius: 4px;
  }

  .cat-card:hover {
    background: #DCD6CF;
    border-color: rgba(28,27,25,0.25);
    transform: translateY(-1px);
  }

  .cat-card-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.55rem;
    font-weight: 700;
    line-height: 1.1;
  }

  .cat-card-count {
    font-size: 12px;
    color: rgba(28,27,25,0.6);
    letter-spacing: 0.02em;
  }

  .cat-card-stats {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    margin: 0;
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
    color: rgba(28,27,25,0.55);
  }

  .cat-card-stat dd {
    font-family: 'Barlow', sans-serif;
    font-size: 15px;
    font-weight: 600;
    color: #1C1B19;
    margin: 0;
  }

  .cat-card-er {
    font-weight: 500;
    color: rgba(28,27,25,0.6);
  }

  .cat-card-arrow {
    margin-top: auto;
    font-size: 12px;
    letter-spacing: 0.04em;
    color: #C8962A;
    font-weight: 600;
  }
`;
