"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";

const links = [
  { href: "/", label: "Veckans raket" },
  { href: "/hall-of-fame", label: "Hall of Fame" },
  { href: "/kalkylator", label: "Kalkylator" },
  { href: "/om-engagemang", label: "Om engagemang" },
];

export default function NavBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <nav className="gr-nav" ref={navRef}>
      <Link href="/" className="gr-nav-logo">
        <span style={{ color: "#C8962A" }}>S</span>ociala raketer
      </Link>

      <div className="gr-nav-links">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={"gr-nav-link" + (pathname === l.href ? " gr-nav-link--active" : "")}
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

      {open && (
        <div className="gr-nav-mobile">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={"gr-nav-mobile-link" + (pathname === l.href ? " gr-nav-mobile-link--active" : "")}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
