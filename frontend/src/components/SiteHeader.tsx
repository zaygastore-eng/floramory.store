import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import BrandLogo from "@/components/BrandLogo";
import { fetchWhatsAppNumber } from "@/lib/api";
import { normalizeWhatsApp } from "@/lib/site";

const navLinks = [
  { href: "/shop", label: "The Chapters" },
  { href: "/#cara-pre-order", label: "Cara Pre-Order" },
  { href: "/#vault", label: "Smart QR Vault" },
  { href: "/cek-pesanan", label: "Cek Pesanan" },
];

const CONSULTATION_MESSAGE =
  "Halo Concierge A Chapter, saya ingin berkonsultasi mengenai karya dan pre-order.";

export default function SiteHeader({ variant = "default" }: { variant?: "default" | "overlay" }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState("6285235242425");
  const [location] = useLocation();

  useEffect(() => {
    let active = true;
    fetchWhatsAppNumber()
      .then(number => {
        if (active) setWhatsappNumber(normalizeWhatsApp(number) || "6285235242425");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (variant !== "overlay") return;
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [variant]);

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

  const consultationUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    CONSULTATION_MESSAGE
  )}`;

  return (
    <>
      <nav
        className={`fm-nav${variant === "overlay" ? ` fm-nav--overlay${scrolled ? " is-scrolled" : ""}` : ""}`}
        aria-label="Navigasi utama"
      >
        <a href="/" className="nav-logo logo-link" aria-label="A Chapter beranda">
          <BrandLogo variant={variant === "overlay" && !scrolled ? "light" : "burgundy"} />
        </a>

        <ul className="nav-links">
          {navLinks.map(({ href, label }) => (
            <li key={href}>
              <a href={href}>{label}</a>
            </li>
          ))}
        </ul>

        <div className="nav-actions">
          <a
            className="nav-commission"
            href={consultationUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Konsultasi
          </a>
          <a
            className="nav-chat-mobile"
            href={consultationUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={closeMenu}
          >
            Konsultasi
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
            <li>
              <a href="/pre-order" onClick={closeMenu}>Pre-Order Karya</a>
            </li>
            <li>
              <a
                href={consultationUrl}
                className="nav-drawer-cta"
                target="_blank"
                rel="noopener noreferrer"
                onClick={closeMenu}
              >
                Konsultasi via WhatsApp →
              </a>
            </li>
          </ul>
        </div>
      )}
    </>
  );
}
