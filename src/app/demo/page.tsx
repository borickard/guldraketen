import type { Metadata } from "next";
import DemoDashboard from "./DemoDashboard";
import DemoBanner from "./DemoBanner";

export const metadata: Metadata = {
  title: "Dashboard-demo — Sociala Raketer",
  description: "Testa Sociala Raketers dashboard med exempeldata — sortera, gruppera och filtrera fritt.",
};

export default function DemoPage() {
  return (
    <>
      <style>{styles}</style>
      <div className="demo-root">
        <DemoBanner />
        <main className="demo-main">
          <DemoDashboard />
        </main>
      </div>
    </>
  );
}

const styles = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .demo-root {
    min-height: 100vh;
    background: #EBE7E2;
    font-family: 'Barlow', sans-serif;
    color: #1C1B19;
  }
  .demo-banner {
    position: sticky;
    z-index: 40;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    flex-wrap: wrap;
    background: #07253A;
    color: #EDF8FB;
    font-size: 13.5px;
    padding: 10px 1.5rem;
    text-align: center;
  }
  /* The persistent demo banner already lives at the top, so the grid's own
     fixed condensed filter bar would overlap it — hide it on the demo. */
  .demo-root .vg-compactbar { display: none; }
  .demo-banner strong {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #C8962A;
    margin-right: 2px;
  }
  .demo-banner-link {
    color: #EDF8FB;
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 3px;
    white-space: nowrap;
  }
  .demo-main {
    max-width: 100%;
    margin: 0 auto;
    padding: 2.5rem 1.5rem 6rem;
  }
`;
