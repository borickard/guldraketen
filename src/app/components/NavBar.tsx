"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";

type NavLink = { href: string; label: string };

const homeLinks: NavLink[] = [
  { href: "/demo",          label: "Dashboard" },
  { href: "#topplistan",    label: "Veckans raketer" },
  { href: "/hall-of-fame",  label: "Hall of Fame" },
  { href: "/kategorier",    label: "Kategorier" },
  { href: "#kalkylator",    label: "Räkna ut engagemang" },
  { href: "#om-engagemang", label: "Om Sociala Raketer" },
  { href: "/stotta",        label: "Stötta" },
];

const otherLinks: NavLink[] = [
  { href: "/demo",           label: "Dashboard" },
  { href: "/#topplistan",    label: "Veckans raketer" },
  { href: "/hall-of-fame",   label: "Hall of Fame" },
  { href: "/kategorier",     label: "Kategorier" },
  { href: "/#kalkylator",    label: "Räkna ut engagemang" },
  { href: "/#om-engagemang", label: "Om Sociala Raketer" },
  { href: "/stotta",         label: "Stötta" },
];

// Shown inline in the desktop bar; the rest live in the hamburger menu.
const PRIMARY_LABELS = ["Dashboard", "Stötta", "Om Sociala Raketer"];

export default function NavBar() {
  const pathname = usePathname();
  // Hide the public nav on dashboard/admin, but compute this AFTER all hooks run
  // (below) — an early return before the hooks would change the hook order
  // between renders and crash React when navigating to/from those sections.
  const hidden = pathname.startsWith("/dashboard") || pathname.startsWith("/admin") || pathname.startsWith("/header-test");
  const isHome = pathname === "/";
  const links = isHome ? homeLinks : otherLinks;
  const primaryLinks = PRIMARY_LABELS
    .map((lbl) => links.find((l) => l.label === lbl))
    .filter((l): l is NavLink => !!l);

  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [navHeight, setNavHeight] = useState(80);
  const navRef = useRef<HTMLElement>(null);

  // Measure nav height whenever drawer opens
  useEffect(() => {
    if (open && navRef.current) {
      setNavHeight(navRef.current.offsetHeight);
    }
  }, [open]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Track scroll for compact mode. The nav is sticky and ~60px shorter when
  // compact, so shrinking it reduces the document height. On a short page the
  // browser then clamps the scroll back up, which flips the state and makes the
  // bar flicker while scrolling. A wide hysteresis (90/170) with a dead zone
  // larger than the height change prevents that loop, and short pages that can't
  // scroll past 170px simply stay expanded (compacting gains nothing there).
  useEffect(() => {
    if (hidden) return;
    function handleScroll() {
      const y = window.scrollY;
      setScrolled(prev => prev ? y > 90 : y > 170);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hidden]);

  // Close drawer on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  if (hidden) return null;

  // Hash targets (#section or /#section) are rendered as plain <a> so the native
  // hashchange fires — Next's <Link> navigates via history without it, which
  // skipped the homepage's scroll-to-section handler (links didn't jump).
  function renderLink(l: NavLink, className: string, onClick?: () => void) {
    if (l.href.includes("#")) {
      return <a key={l.href} href={l.href} className={className} onClick={onClick}>{l.label}</a>;
    }
    return <Link key={l.href} href={l.href} className={className} onClick={onClick}>{l.label}</Link>;
  }

  return (
    <>
      <nav ref={navRef} className={"gr-nav" + (scrolled ? " gr-nav--compact" : "")}>
        <a href="/" className="gr-nav-logo">
          Sociala raketer
        </a>

        <div className="gr-nav-right">
          <div className="gr-nav-links">
            {primaryLinks.map((l) => renderLink(l, "gr-nav-link"))}
          </div>

          <button
            className={"gr-hamburger" + (open ? " open" : "")}
            onClick={() => setOpen(!open)}
            aria-label="Meny"
            aria-expanded={open}
          >
            <span className="gr-ham-bar gr-ham-bar-1" />
            <span className="gr-ham-bar gr-ham-bar-2" />
            <span className="gr-ham-bar gr-ham-bar-3" />
          </button>
        </div>
      </nav>

      {open && (
        <>
          <div
            className="gr-nav-drawer-backdrop"
            onClick={() => setOpen(false)}
          />
          <div className="gr-nav-mobile" style={{ top: navHeight }}>
            {links.map((l) =>
              renderLink(l, "gr-nav-mobile-link", () => {
                // Unlock body scroll synchronously so hash links (#topplistan)
                // can actually scroll the page. The useEffect cleanup that
                // resets overflow runs after the click resolves, which is
                // too late for the browser's hash-jump.
                document.body.style.overflow = "";
                setOpen(false);
              })
            )}
          </div>
        </>
      )}
    </>
  );
}
