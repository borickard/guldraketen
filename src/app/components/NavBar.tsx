"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const homeLinks = [
  { href: "#topplistan",    label: "Veckans raketer" },
  { href: "#kalkylator",    label: "Räkna ut engagemang" },
  { href: "#om-engagemang", label: "Om Sociala\u00A0Raketer" },
];

const otherLinks = [
  { href: "/#topplistan",   label: "Veckans raketer" },
  { href: "/#kalkylator",   label: "Räkna ut engagemang" },
  { href: "/om-engagemang", label: "Om Sociala\u00A0Raketer" },
];

export default function NavBar() {
  const pathname = usePathname();
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin") || pathname.startsWith("/header-test")) return null;
  const isHome = pathname === "/";
  const links = isHome ? homeLinks : otherLinks;

  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Track scroll for compact mode — hysteresis prevents jitter near threshold
  useEffect(() => {
    function handleScroll() {
      const y = window.scrollY;
      setScrolled(prev => prev ? y > 30 : y > 80);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close drawer on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <>
      <nav className={"gr-nav" + (scrolled ? " gr-nav--compact" : "")}>
        <a href="/" className="gr-nav-logo">
          Sociala raketer
        </a>

        <div className="gr-nav-links">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="gr-nav-link"
            >
              {l.label}
            </Link>
          ))}
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
      </nav>

      {open && (
        <>
          <div
            className="gr-nav-drawer-backdrop"
            onClick={() => setOpen(false)}
          />
          <div className="gr-nav-mobile">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="gr-nav-mobile-link"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
