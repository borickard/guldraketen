import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Vad är engagemang? — Sociala Raketer",
  description: "Så räknar vi ut engagemangsgraden — viktat för att premiera äkta interaktioner.",
};

export default function OmEngagemang() {
  return (
    <main className="gr-root gr-page">
      <div className="gr-page-content">

        <h1 className="gr-page-title">Vad är egentligen engagemang?</h1>

        <p className="gr-page-lead">
          Likes i all ära. Men när någon kommenterar har de stannat upp —
          något väckte en reaktion. Och när de delar? Då har du nått fram
          genom bruset, rört något, och fått dem att säga:{" "}
          <em>&ldquo;det här måste du se.&rdquo;</em>{" "}
          Det är vår definition av engagemang.
        </p>

        <h2 className="gr-page-subtitle">Inte alla interaktioner är likvärdiga</h2>

        <p className="gr-page-body">
          En like kostar ingenting. Du scrollar förbi, tummen fastnar, vidare.
          Det är förstås en indikation på att du nått ut — men det är lågt
          engagemang som ligger bakom en like.
        </p>
        <p className="gr-page-body">
          En kommentar kräver mer. Någon stannade upp, ville delta, hade
          något att säga. Det är en signal om att innehållet faktiskt skapade
          en reaktion.
        </p>
        <p className="gr-page-body">
          En delning är något helt annat. Att dela en video betyder att du
          tar den med dig ut ur appen och visar den för andra — det kräver
          engagemang, omdöme och en vilja att associera sig med innehållet.
          Det är den starkaste signal en tittare kan ge.
        </p>

        <h2 className="gr-page-subtitle">Vår formel</h2>

        <p className="gr-page-body">Vi beräknar engagemangsgrad så här:</p>

        <div className="gr-formula-box">
          <div className="gr-formula">
            (likes × 1) + (kommentarer × 5) + (delningar × 10)
            <span className="gr-formula-divider">÷</span>
            visningar × 100
          </div>
          <p className="gr-formula-label">= Engagemangsgrad (%)</p>
        </div>

        <p className="gr-page-body">
          Delningar väger tio gånger mer än en like. Kommentarer väger fem
          gånger mer. Det är ett medvetet val: vi vill belöna innehåll som
          verkligen når fram, inte innehåll som råkar synas för många.
        </p>

        <h2 className="gr-page-subtitle">Varför bara bästa videon?</h2>

        <p className="gr-page-body">
          Sociala Raketer rankar konton på deras <strong>starkaste</strong> video varje vecka
          — inte på ett genomsnitt. Det är ett medvetet designbeslut. Volym
          ska inte belönas. Det som räknas är om du någon gång lyckades
          skapa något som verkligen engagerade. En raket är en raket.
        </p>

        <h2 className="gr-page-subtitle">Testa din egen video</h2>

        <p className="gr-page-body">
          Undrar du hur din video presterar? Klistra in en länk i
          kalkylatorn så räknar vi ut engagemangsgraden direkt och jämför
          mot svenska företagsvideor i vår databas.
        </p>

        <Link href="/kalkylator" className="gr-cta-btn" style={{ display: "inline-block", marginTop: "8px" }}>
          Öppna kalkylatorn
        </Link>

      </div>
    </main>
  );
}
