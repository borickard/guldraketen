"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "Veckans raket" },
  { href: "/hall-of-fame", label: "Hall of Fame" },
  { href: "/nominera", label: "Nominera" },
  { href: "/om-engagemang", label: "Om engagemang" },
];

export default function NavBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="gr-nav">
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

      <button className="gr-hamburger" onClick={() => setOpen(!open)} aria-label="Meny">
        <span style={{ display: "block", width: "22px", height: "2px", background: "#1C1B19", borderRadius: "2px" }} />
        <span style={{ display: "block", width: "22px", height: "2px", background: "#1C1B19", borderRadius: "2px" }} />
        <span style={{ display: "block", width: "14px", height: "2px", background: "#1C1B19", borderRadius: "2px" }} />
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
