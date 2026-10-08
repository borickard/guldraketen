"use client";

import { useEffect, useState } from "react";

// Sticky demo banner. The global nav is sticky at the top and changes height
// when it compacts on scroll, so we track its live height and pin the banner
// flush beneath it — no gap, no overlap, whatever state the nav is in.
export default function DemoBanner() {
  const [top, setTop] = useState(0);

  useEffect(() => {
    const nav = document.querySelector<HTMLElement>(".gr-nav");
    const update = () => setTop(nav ? Math.round(nav.getBoundingClientRect().height) : 0);
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    nav?.addEventListener("transitionend", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      nav?.removeEventListener("transitionend", update);
    };
  }, []);

  return (
    <div className="demo-banner" style={{ top }}>
      <span>
        <strong>Demo</strong> — exempeldata. Sortera och filtrera fritt för att se hur en personlig
        dashboard fungerar.
      </span>
      <a href="/for-foretag" className="demo-banner-link">Skaffa din egen →</a>
    </div>
  );
}
