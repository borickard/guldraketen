"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const homeLinks = [
  { href: "#topplistan",    label: "Topplistan" },
  { href: "#kalkylator",    label: "Kalkylator" },
  { href: "#hall-of-fame",  label: "Hall of Fame" },
  { href: "#om-engagemang", label: "Om engagemang" },
];

const otherLinks = [
  { href: "/#topplistan",   label: "Topplistan" },
  { href: "/#kalkylator",   label: "Kalkylator" },
  { href: "/hall-of-fame",  label: "Hall of Fame" },
  { href: "/om-engagemang", label: "Om engagemang" },
];

export default function NavBar() {
  const pathname = usePathname();
  if (pathname.startsWith("/dashboard")) return null;
  const isHome = pathname === "/";
  const links = isHome ? homeLinks : otherLinks;

  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Track scroll for compact mode
  useEffect(() => {
    function handleScroll() { setScrolled(window.scrollY > 60); }
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
