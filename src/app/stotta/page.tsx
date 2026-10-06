import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stötta Sociala Raketer",
  description: "Sociala Raketer är gratis och oberoende. Tycker du det fyller en funktion? Var med och backa projektet.",
};

// Stripe "pay what you want" dricks-länk (SEK).
const STRIPE_TIP_URL = "https://buy.stripe.com/6oU28kgqaduC6qI3PI5kk00";

const CoffeeIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
    <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
    <line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
  </svg>
);

const CardIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <line x1="2" y1="10" x2="22" y2="10" />
  </svg>
);

export default function Stotta() {
  return (
    <main className="gr-root gr-stotta">
      <div className="gr-stotta-inner">
        <header className="gr-stotta-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="gr-stotta-mark" width={64} height={64} />
          <h1 className="gr-stotta-title">Stötta Sociala Raketer</h1>
          <p className="gr-stotta-lead">
            Sociala Raketer är ett oberoende projekt som lyfter fram svenskt innehåll som
            faktiskt engagerar — gratis för alla att använda. Datan bakom kostar dock pengar
            varje månad. Tycker du det fyller en funktion? Då kan du vara med och backa det.
          </p>
        </header>

        <div className="gr-stotta-cards">
          <div className="gr-stotta-card">
            <span className="gr-stotta-card-badge gr-stotta-card-badge--gold">
              <CoffeeIcon />
            </span>
            <h2 className="gr-stotta-card-title">Ko-fi</h2>
            <p className="gr-stotta-card-text">
              Engångsbidrag eller återkommande stöd — kort, Apple Pay och PayPal.
            </p>
            <a
              href="https://ko-fi.com/rickardb"
              target="_blank"
              rel="noopener noreferrer"
              className="gr-kofi-btn gr-stotta-cta"
            >
              Stötta på Ko-fi
            </a>
          </div>

          <div className="gr-stotta-card">
            <span className="gr-stotta-card-badge">
              <CardIcon />
            </span>
            <h2 className="gr-stotta-card-title">Betala direkt</h2>
            <p className="gr-stotta-card-text">
              Välj valfritt belopp i svenska kronor — kort, Apple Pay och Google Pay.
            </p>
            <a
              href={STRIPE_TIP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="gr-stripe-btn gr-stotta-cta"
            >
              Ge dricks
            </a>
          </div>
        </div>

        <p className="gr-stotta-foot">Varje bidrag håller raketen i luften. 🚀</p>
      </div>
    </main>
  );
}
