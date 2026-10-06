import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stötta Sociala Raketer",
  description: "Gillar du Sociala Raketer? Bjud på en kaffe och hjälp till att hålla raketerna i luften.",
};

// Fyll i Swish-numret (eller Swish Handel-numret) för att visa Swish-kortet.
// Lämnas tomt tills vidare — kortet visas inte förrän ett nummer finns här.
const SWISH_NUMBER = "";

const CoffeeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
    <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
    <line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
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

          {SWISH_NUMBER && (
            <div className="gr-stotta-card">
              <h2 className="gr-stotta-card-title">Swish</h2>
              <p className="gr-stotta-card-text">
                Föredrar du Swish? Skanna QR-koden eller skicka till numret nedan.
              </p>
              <p className="gr-stotta-swish-number">{SWISH_NUMBER}</p>
            </div>
          )}
        </div>

        <p className="gr-page-body" style={{ marginTop: "var(--space-5)", opacity: 0.85 }}>
          Vill du ha tillgång till dashboarden med djupare analys av ditt eget innehåll?
          Hör av dig så löser vi det.
        </p>
      </div>
    </main>
  );
}
