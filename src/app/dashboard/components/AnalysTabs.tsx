// Sub-tabs shown under the header on the two analysis pages, so "Analys" in the
// nav opens a clear choice between comparing your own content and comparing
// accounts. Plain <a> links for the full-reload navigation the dashboard uses.
export default function AnalysTabs({ active }: { active: "innehall" | "konton" }) {
  return (
    <>
      <style>{css}</style>
      <nav className="at-wrap" aria-label="Analys">
        <a href="/dashboard/segment" className={`at-tab${active === "innehall" ? " at-tab--on" : ""}`}>
          Innehåll
        </a>
        <a href="/dashboard/jamforelse" className={`at-tab${active === "konton" ? " at-tab--on" : ""}`}>
          Konton
        </a>
      </nav>
    </>
  );
}

const css = `
  .at-wrap {
    display: inline-flex;
    gap: 4px;
    background: rgba(28,27,25,0.06);
    border-radius: 999px;
    padding: 4px;
    margin-bottom: 1.75rem;
  }
  .at-tab {
    font-family: 'Barlow', sans-serif;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: rgba(28,27,25,0.6);
    text-decoration: none;
    padding: 7px 20px;
    border-radius: 999px;
    transition: background 0.12s, color 0.12s;
  }
  .at-tab:hover { color: #1C1B19; }
  .at-tab--on {
    background: #fff;
    color: #1C1B19;
    box-shadow: 0 1px 2px rgba(28,27,25,0.1);
  }
`;
