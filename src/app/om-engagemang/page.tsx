import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Om engagemang — Sociala raketer",
  description: "Så räknar vi ut engagemangsgraden — viktat för att premiera äkta interaktioner.",
};

export default function OmEngagemang() {
  return (
    <main className="gr-root gr-page">
      <div className="gr-page-content">
        <h1 className="gr-page-title">Hur räknar vi?</h1>

        <p className="gr-page-lead">
          Alla interaktioner är inte lika mycket värda. Att trycka på en hjärta tar en sekund. Att skriva en kommentar kräver en tanke. Att dela vidare kräver att du faktiskt vill att någon annan ska se den.
        </p>

        <div className="gr-formula-box">
          <div className="gr-formula">
            (likes × 1) + (kommentarer × 5) + (delningar × 10)
            <span className="gr-formula-divider">÷</span>
            visningar × 100
          </div>
          <p className="gr-formula-label">= Engagemangsgrad (%)</p>
        </div>

        <h2 className="gr-page-subtitle">Viktningen</h2>

        <div className="gr-weight-list">
          <div className="gr-weight-item">
            <div className="gr-weight-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z"/></svg>
            </div>
            <div>
              <div className="gr-weight-name">Like <span className="gr-weight-mult">× 1</span></div>
              <div className="gr-weight-desc">Ett like är snabbt och enkelt. Det signalerar att något fångade uppmärksamheten — men inte nödvändigtvis att det stannade kvar.</div>
            </div>
          </div>

          <div className="gr-weight-item">
            <div className="gr-weight-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c-4.97 0-9 3.186-9 7.115 0 2.055.999 3.898 2.604 5.207-.141.994-.671 2.716-2.604 3.678 2.132-.142 4.658-1.113 5.922-2.203C9.883 16.943 10.925 17 12 17c4.97 0 9-3.186 9-7.115C21 6.186 16.97 3 12 3z"/></svg>
            </div>
            <div>
              <div className="gr-weight-name">Kommentar <span className="gr-weight-mult">× 5</span></div>
              <div className="gr-weight-desc">En kommentar kräver att tittaren stannade upp, hade en tanke och valde att formulera den. Det är ett tydligt tecken på äkta engagemang.</div>
            </div>
          </div>

          <div className="gr-weight-item">
            <div className="gr-weight-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 014-4h12"/></svg>
            </div>
            <div>
              <div className="gr-weight-name">Delning <span className="gr-weight-mult">× 10</span></div>
              <div className="gr-weight-desc">Att dela är det starkaste signalet av alla. Det innebär att tittaren aktivt valde att sätta sitt namn på innehållet och skicka det vidare — <em>"det här måste du se."</em></div>
            </div>
          </div>
        </div>

        <h2 className="gr-page-subtitle">Rankingen</h2>
        <p className="gr-page-body">
          Varje vecka rankar vi konton baserat på deras <strong>bästa enskilda video</strong> under veckan. Ett konto vinner på sin starkaste prestation, inte på volym. Videon måste ha minst 10 000 visningar för att räknas.
        </p>
        <p className="gr-page-body">
          Det är ett medvetet val: vi vill belöna genomslagskraft, inte flitig publicering.
        </p>
      </div>
    </main>
  );
}
