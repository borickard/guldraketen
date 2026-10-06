import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stötta Sociala Raketer",
  description: "Gillar du Sociala Raketer? Bjud på en kaffe och hjälp till att hålla raketerna i luften.",
};

// Stripe "pay what you want" dricks-länk (SEK).
const STRIPE_TIP_URL = "https://buy.stripe.com/6oU28kgqaduC6qI3PI5kk00";

const CoffeeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
    <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
    <line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
  </svg>
);

const CardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <line x1="2" y1="10" x2="22" y2="10" />
  </svg>
);

export default function Stotta() {
  return (
    <main className="gr-root gr-page">
      <div className="gr-page-content">
        <h1 className="gr-page-title">Stötta Sociala Raketer</h1>

        <p className="gr-page-lead">
          Sociala Raketer är ett passionsprojekt — jag bygger och driver det på fritiden,
          och scraping och hosting kostar varje månad. Gillar du det? Bjud gärna på en kaffe.
          Varje bidrag hjälper till att hålla raketerna i luften.
        </p>

        <div className="gr-stotta-cards">
          <div className="gr-stotta-card">
            <h2 className="gr-stotta-card-title">Ko-fi</h2>
            <p className="gr-stotta-card-text">
              Engångsbidrag eller återkommande stöd — fungerar med kort, Apple Pay och PayPal.
            </p>
            <a
              href="https://ko-fi.com/rickardb"
              target="_blank"
              rel="noopener noreferrer"
              className="gr-kofi-btn"
            >
              <CoffeeIcon />
              Stötta på Ko-fi
            </a>
          </div>

          <div className="gr-stotta-card">
            <h2 className="gr-stotta-card-title">Betala direkt</h2>
            <p className="gr-stotta-card-text">
              Välj valfritt belopp i svenska kronor — kort, Apple Pay och Google Pay.
            </p>
            <a
              href={STRIPE_TIP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="gr-stripe-btn"
            >
              <CardIcon />
              Ge dricks
            </a>
          </div>
        </div>

        <p className="gr-page-body" style={{ marginTop: "var(--space-5)", opacity: 0.85 }}>
          Vill du ha tillgång till dashboarden med djupare analys av ditt eget innehåll?
          Hör av dig så löser vi det.
        </p>
      </div>
    </main>
  );
}
