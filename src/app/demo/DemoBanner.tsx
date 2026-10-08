"use client";

import { useEffect, useRef } from "react";

// Sticky demo banner. The global nav is sticky at the top and animates its
// height when it compacts on scroll (~0.25s). A ResizeObserver tracks the nav's
// live height and we write the banner's `top` straight to the DOM node each
// frame of the animation — going through React state lagged a frame and opened a
// brief gap. A 1px overlap (the navy nav sits above and covers it) absorbs any
// sub-pixel rounding so no seam ever shows.
export default function DemoBanner() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nav = document.querySelector<HTMLElement>(".gr-nav");
    const el = ref.current;
    if (!nav || !el) return;
    const update = () => {
      el.style.top = Math.max(0, Math.floor(nav.getBoundingClientRect().height) - 1) + "px";
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(nav);
    window.addEventListener("resize", update, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div ref={ref} className="demo-banner">
      <span>
        <strong>Demo</strong> — exempeldata. Sortera och filtrera fritt för att se hur en personlig
        dashboard fungerar.
      </span>
      <a href="/for-foretag" className="demo-banner-link">Skaffa din egen →</a>
    </div>
  );
}
