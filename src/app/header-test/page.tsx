export default function HeaderTestPage() {
  const fonts = [
    {
      name: "VT323 (nuvarande)",
      family: "VT323",
      googleParam: "VT323",
      weight: "400",
    },
    {
      name: "Playfair Display",
      family: "Playfair Display",
      googleParam: "Playfair+Display:wght@700",
      weight: "700",
    },
    {
      name: "Changa One",
      family: "Changa One",
      googleParam: "Changa+One",
      weight: "400",
    },
    {
      name: "Instrument Serif",
      family: "Instrument Serif",
      googleParam: "Instrument+Serif",
      weight: "400",
    },
    {
      name: "Cherry Bomb One",
      family: "Cherry Bomb One",
      googleParam: "Cherry+Bomb+One",
      weight: "400",
    },
    {
      name: "Modak",
      family: "Modak",
      googleParam: "Modak",
      weight: "400",
    },
    {
      name: "Bagel Fat One",
      family: "Bagel Fat One",
      googleParam: "Bagel+Fat+One",
      weight: "400",
    },
    {
      name: "Rubik Maps",
      family: "Rubik Maps",
      googleParam: "Rubik+Maps",
      weight: "400",
    },
    {
      name: "Pirata One",
      family: "Pirata One",
      googleParam: "Pirata+One",
      weight: "400",
    },
    {
      name: "Jersey 10",
      family: "Jersey 10",
      googleParam: "Jersey+10",
      weight: "400",
    },
  ];

  const navLinks = ["Topplistan", "Kalkylator", "Hall of Fame", "Om engagemang"];

  const googleFontsUrl =
    "https://fonts.googleapis.com/css2?" +
    fonts
      .filter((f) => f.name !== "VT323 (nuvarande)")
      .map((f) => `family=${f.googleParam}`)
      .join("&") +
    "&display=swap";

  return (
    <>
      <style>{`
        @import url('${googleFontsUrl}');

        .ht-root {
          background: #EBE7E2;
          min-height: 100vh;
          padding: 40px 0 80px;
          font-family: 'Barlow', sans-serif;
        }

        .ht-page-title {
          font-family: 'Barlow Condensed', sans-serif;
          font-weight: 700;
          font-size: 13px;
          letter-spacing: .1em;
          text-transform: uppercase;
          color: rgba(28,27,25,0.4);
          padding: 0 40px 32px;
        }

        .ht-section {
          margin-bottom: 32px;
        }

        .ht-label {
          font-family: 'Barlow', sans-serif;
          font-size: 11px;
          letter-spacing: .1em;
          text-transform: uppercase;
          color: rgba(28,27,25,0.35);
          padding: 0 40px 8px;
        }

        .ht-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 40px;
          background: #07253A;
          border-top: 1px solid rgba(237,248,251,0.06);
          border-bottom: 1px solid rgba(237,248,251,0.06);
        }

        .ht-wordmark {
          font-size: 64px;
          letter-spacing: .05em;
          text-transform: uppercase;
          color: #EDF8FB;
          line-height: 1;
        }

        .ht-nav-links {
          display: flex;
          gap: 24px;
          align-items: center;
        }

        .ht-nav-link {
          font-family: 'Barlow', sans-serif;
          font-size: 11px;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: rgba(237,248,251,0.6);
        }

        @media (max-width: 600px) {
          .ht-nav { padding: 14px 20px; }
          .ht-label { padding: 0 20px 8px; }
          .ht-page-title { padding: 0 20px 28px; }
          .ht-wordmark { font-size: 36px; }
          .ht-nav-links { display: none; }
        }
      `}</style>

      <div className="ht-root">
        <p className="ht-page-title">Header font test — Sociala Raketer</p>

        {fonts.map((font) => (
          <div key={font.name} className="ht-section">
            <p className="ht-label">{font.name}</p>
            <div className="ht-nav">
              <span
                className="ht-wordmark"
                style={{ fontFamily: `'${font.family}', sans-serif`, fontWeight: font.weight }}
              >
                Sociala raketer
              </span>
              <div className="ht-nav-links">
                {navLinks.map((l) => (
                  <span key={l} className="ht-nav-link">{l}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
