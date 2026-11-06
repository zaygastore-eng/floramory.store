import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import BrandLogo from "@/components/BrandLogo";

const navLinks = [
  { href: "/#chapters", label: "The Chapters" },
  { href: "/#single-stems", label: "Single Stems" },
  { href: "/#gift-cards", label: "Gift Cards" },
  { href: "/#vault", label: "Smart QR Vault" },
];

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <nav className="fm-nav" aria-label="Navigasi utama">
        <a href="/" className="nav-logo logo-link" aria-label="A Chapter beranda">
          <BrandLogo />
        </a>

        <ul className="nav-links">
          {navLinks.map(({ href, label }) => (
            <li key={href}>
              <a href={href}>{label}</a>
            </li>
          ))}
        </ul>

        <div className="nav-actions">
          <a className="nav-commission" href="/#pesan">
            Commission / Chat
          </a>
          <a className="nav-chat-mobile" href="/#pesan" onClick={closeMenu}>
            Chat
          </a>
          <button
            type="button"
            className="nav-menu-btn"
            aria-label={menuOpen ? "Tutup menu" : "Buka menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-drawer"
            onClick={() => setMenuOpen(open => !open)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div
          className="nav-drawer"
          id="mobile-nav-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Menu navigasi"
          onClick={event => {
            if (event.target === event.currentTarget) closeMenu();
          }}
        >
          <div className="nav-drawer-header">
            <a href="/" className="nav-logo logo-link" aria-label="A Chapter beranda" onClick={closeMenu}>
              <BrandLogo />
            </a>
            <button type="button" className="nav-drawer-close" onClick={closeMenu} aria-label="Tutup menu">
              <span aria-hidden="true">✕</span>
            </button>
          </div>
          <ul className="nav-drawer-links">
            {navLinks.map(({ href, label }) => (
              <li key={href}>
                <a href={href} onClick={closeMenu}>{label}</a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
