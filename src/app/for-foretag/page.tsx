import type { Metadata } from "next";
import InterestForm from "./InterestForm";

export const metadata: Metadata = {
  title: "Personlig dashboard för ert TikTok — Sociala Raketer",
  description:
    "Se exakt vad som får ert TikTok-innehåll att engagera. Alla inlägg, viktad engagement rate, trender över tid och jämförelser mot er kategori. Anmäl intresse för en egen dashboard.",
};

function Check() {
  return (
    <svg className="ff-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

const FEATURES: { title: string; text: string }[] = [
  {
    title: "Alla era inlägg samlade",
    text: "Statistik per inlägg — sortera, gruppera per vecka eller månad och filtrera fritt på visningar, likes, kommentarer och delningar.",
  },
  {
    title: "Viktad engagement rate",
    text: "Samma formel som topplistan: delningar och favoriter väger tyngst. Se vad som faktiskt engagerar — inte bara antalet likes.",
  },
  {
    title: "Jämför mot din kategori",
    text: "Percentiler och benchmarks mot liknande svenska konton, så ni vet om ett inlägg är bra eller bara okej.",
  },
  {
    title: "Följ utvecklingen över tid",
    text: "Följartillväxt och engagemang vecka för vecka — se trenden, inte bara en ögonblicksbild.",
  },
  {
    title: "Tagga och organisera",
    text: "Gruppera kampanjer, format och teman med egna taggar och jämför hur de presterar mot varandra.",
  },
  {
    title: "Organiskt vs boostat",
    text: "Skilj på betald räckvidd och organiskt genomslag, där datan finns — så siffrorna inte lurar er.",
  },
];

const INCLUDED: string[] = [
  "Egen dashboard för ert konto",
  "Uppdateras automatiskt varje vecka",
  "Viktad engagement rate + benchmarks",
  "Tagga, gruppera och jämför inlägg",
  "Historik och trender över tid",
  "Support direkt från den som bygger verktyget",
];

export default function ForForetag() {
  return (
    <>
      <style>{styles}</style>
      <main className="ff-page">
        {/* Hero — primary action */}
        <section className="ff-hero">
          <div className="ff-hero-inner">
            <span className="ff-eyebrow">Personlig dashboard · för företag</span>
            <h1 className="ff-title">Se exakt vad som får ert TikTok-innehåll att engagera</h1>
            <p className="ff-lead">
              Sociala Raketer rankar Sveriges mest engagerande företagskonton på TikTok. Med en
              egen dashboard får ni samma analys för ert eget konto — alla inlägg, viktad
              engagement rate, trender över tid och jämförelser mot er kategori.
            </p>

            <div className="ff-cta" id="anmal">
              <InterestForm />
            </div>

            <p className="ff-hero-alt">
              Vill du se den först? <a href="/demo" className="ff-link">Testa demon →</a>
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="ff-section">
          <h2 className="ff-h2">Vad ni får</h2>
          <div className="ff-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="ff-card">
                <h3 className="ff-card-title">{f.title}</h3>
                <p className="ff-card-text">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Demo band */}
        <section className="ff-demo-band">
          <div className="ff-demo-band-inner">
            <div>
              <h2 className="ff-demo-title">Klicka runt i en riktig dashboard</h2>
              <p className="ff-demo-text">
                Demon är hela dashboarden med exempeldata — sortera, gruppera och filtrera fritt
                för att se hur det känns med ert eget innehåll.
              </p>
            </div>
            <a href="/demo" className="ff-btn ff-btn--demo">Testa demon</a>
          </div>
        </section>

        {/* Pricing */}
        <section className="ff-section">
          <h2 className="ff-h2">Vad det kostar</h2>
          <div className="ff-price-card">
            <span className="ff-eyebrow">Introduktionspris</span>
            <p className="ff-price">
              Från <strong>99 kr</strong><span className="ff-price-unit"> / mån</span>
            </p>
            <p className="ff-price-sub">ex. moms · eller 990 kr/år — två månader på köpet</p>
            <p className="ff-price-note">
              Preliminärt pris. Anmäl intresse nu så låser du introduktionserbjudandet och får en
              plats i första omgången.
            </p>
            <ul className="ff-included">
              {INCLUDED.map((i) => (
                <li key={i} className="ff-included-item"><Check />{i}</li>
              ))}
            </ul>
            <a href="#anmal" className="ff-btn ff-btn--primary">Anmäl intresse</a>
          </div>
        </section>

        {/* Trust / closing */}
        <section className="ff-section ff-closing">
          <p className="ff-closing-text">
            Sociala Raketer byggs och drivs på fritiden av Rickard, digital strateg. Ni pratar
            direkt med den som bygger verktyget — och är med och formar det.
          </p>
          <a href="#anmal" className="ff-link ff-link--big">Anmäl intresse →</a>
        </section>
      </main>
    </>
  );
}

const styles = `
  *, *::before, *::after { box-sizing: border-box; }

  .ff-page {
    background: #EBE7E2;
    min-height: 100vh;
    color: #1C1B19;
    font-family: 'Barlow', sans-serif;
  }

  .ff-section {
    max-width: 960px;
    margin: 0 auto;
    padding: 3.5rem 1.5rem 0;
  }

  .ff-eyebrow {
    display: inline-block;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #C8962A;
    margin-bottom: 0.6rem;
  }

  /* Hero */
  .ff-hero {
    padding-top: 2rem;
  }
  .ff-hero-inner {
    max-width: 760px;
    margin: 0 auto;
    padding: 4.5rem 1.5rem 0;
    text-align: center;
  }
  .ff-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: clamp(2.1rem, 6vw, 3.6rem);
    font-weight: 700;
    line-height: 1.02;
    letter-spacing: -0.01em;
    margin-bottom: 1rem;
  }
  .ff-lead {
    font-size: clamp(15px, 2.4vw, 18px);
    line-height: 1.55;
    color: rgba(28,27,25,0.72);
    max-width: 620px;
    margin: 0 auto 2rem;
  }

  /* Interest form (primary action) */
  .ff-cta {
    scroll-margin-top: 90px;
    background: #fff;
    border: 1.5px solid rgba(28,27,25,0.12);
    border-radius: 16px;
    padding: 1.4rem;
    box-shadow: 0 10px 30px rgba(28,27,25,0.07);
    text-align: left;
  }
  .ff-form-done, .ff-form { width: 100%; }
  .ff-fields {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
  }
  .ff-input {
    flex: 1 1 180px;
    min-width: 0;
    font-family: 'Barlow', sans-serif;
    font-size: 15px;
    padding: 0.85rem 1rem;
    border: 1.5px solid rgba(28,27,25,0.15);
    border-radius: 10px;
    background: #fbfaf9;
    color: #1C1B19;
  }
  .ff-input::placeholder { color: rgba(28,27,25,0.4); }
  .ff-input:focus { outline: none; border-color: #C8962A; background: #fff; }
  .ff-submit {
    flex: 0 0 auto;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    padding: 0.85rem 1.6rem;
    border: none;
    border-radius: 10px;
    background: #E8116A;
    color: #fff;
    cursor: pointer;
    transition: opacity 0.12s;
    white-space: nowrap;
  }
  .ff-submit:hover { opacity: 0.9; }
  .ff-submit:disabled { opacity: 0.55; cursor: default; }
  .ff-error { color: #E8116A; font-size: 13px; margin-top: 0.6rem; }
  .ff-note { color: rgba(28,27,25,0.5); font-size: 12.5px; margin-top: 0.7rem; }
  .ff-form--done { text-align: center; padding: 0.5rem 0; }
  .ff-done-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: #1C1B19;
    margin-bottom: 0.3rem;
  }
  .ff-done-text { font-size: 14px; color: rgba(28,27,25,0.65); }

  .ff-hero-alt {
    margin-top: 1.1rem;
    font-size: 14px;
    color: rgba(28,27,25,0.6);
  }
  .ff-link { color: #C8962A; font-weight: 700; text-decoration: none; }
  .ff-link:hover { text-decoration: underline; }
  .ff-link--big { font-size: 17px; }

  .ff-h2 {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: clamp(1.6rem, 4vw, 2.2rem);
    font-weight: 700;
    line-height: 1.05;
    margin-bottom: 1.4rem;
    text-align: center;
  }

  /* Feature grid */
  .ff-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1rem;
  }
  .ff-card {
    background: #E2DDD7;
    border: 1px solid rgba(28,27,25,0.1);
    border-radius: 12px;
    padding: 1.4rem;
  }
  .ff-card-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.3rem;
    font-weight: 700;
    line-height: 1.1;
    margin-bottom: 0.5rem;
  }
  .ff-card-text {
    font-size: 14px;
    line-height: 1.5;
    color: rgba(28,27,25,0.7);
  }

  /* Demo band */
  .ff-demo-band {
    max-width: 960px;
    margin: 3.5rem auto 0;
    padding: 0 1.5rem;
  }
  .ff-demo-band-inner {
    background: #07253A;
    color: #EDF8FB;
    border-radius: 16px;
    padding: 2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
  }
  .ff-demo-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.6rem;
    font-weight: 700;
    line-height: 1.05;
    margin-bottom: 0.4rem;
  }
  .ff-demo-text {
    font-size: 14.5px;
    line-height: 1.5;
    color: rgba(237,248,251,0.78);
    max-width: 540px;
  }

  /* Buttons */
  .ff-btn {
    display: inline-block;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    padding: 0.8rem 1.8rem;
    border-radius: 10px;
    text-decoration: none;
    white-space: nowrap;
    transition: opacity 0.12s, transform 0.12s;
  }
  .ff-btn:hover { transform: translateY(-1px); }
  .ff-btn--primary { background: #E8116A; color: #fff; }
  .ff-btn--demo { background: #C8962A; color: #1C1B19; }

  /* Pricing */
  .ff-price-card {
    max-width: 480px;
    margin: 0 auto;
    background: #fff;
    border: 1.5px solid rgba(28,27,25,0.12);
    border-radius: 16px;
    padding: 2rem;
    text-align: center;
    box-shadow: 0 10px 30px rgba(28,27,25,0.07);
  }
  .ff-price {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.6rem;
    font-weight: 600;
    color: rgba(28,27,25,0.7);
    line-height: 1;
    margin-bottom: 0.4rem;
  }
  .ff-price strong {
    font-size: 3.2rem;
    font-weight: 700;
    color: #1C1B19;
  }
  .ff-price-unit { font-size: 1.4rem; color: rgba(28,27,25,0.55); }
  .ff-price-sub { font-size: 14px; color: rgba(28,27,25,0.6); margin-bottom: 0.9rem; }
  .ff-price-note {
    font-size: 13.5px;
    line-height: 1.5;
    color: rgba(28,27,25,0.6);
    background: rgba(200,150,42,0.1);
    border-radius: 10px;
    padding: 0.75rem 0.9rem;
    margin-bottom: 1.4rem;
  }
  .ff-included {
    list-style: none;
    text-align: left;
    margin: 0 0 1.6rem;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .ff-included-item {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    font-size: 14.5px;
    color: #1C1B19;
  }
  .ff-check { color: #117A5B; flex-shrink: 0; margin-top: 1px; }

  /* Closing */
  .ff-closing {
    text-align: center;
    padding-bottom: 4.5rem;
  }
  .ff-closing-text {
    font-size: 15px;
    line-height: 1.6;
    color: rgba(28,27,25,0.68);
    max-width: 560px;
    margin: 0 auto 1.1rem;
  }

  @media (max-width: 560px) {
    .ff-fields { flex-direction: column; }
    .ff-submit { width: 100%; }
    .ff-demo-band-inner { flex-direction: column; align-items: flex-start; }
    .ff-btn--demo { width: 100%; text-align: center; }
  }
`;
