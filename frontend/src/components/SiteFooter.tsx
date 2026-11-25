import { useState, useEffect } from "react";
import { Link } from "wouter";
import BrandLogo from "@/components/BrandLogo";
import { fetchWhatsAppNumber } from "@/lib/api";
import { normalizeWhatsApp } from "@/lib/site";

export default function SiteFooter() {
  const [whatsappNumber, setWhatsappNumber] = useState("6285235242425");

  useEffect(() => {
    let active = true;
    fetchWhatsAppNumber().then((number) => {
      if (active) setWhatsappNumber(normalizeWhatsApp(number) || "6285235242425");
    });
    return () => {
      active = false;
    };
  }, []);

  const conciergeUrl = `https://wa.me/${whatsappNumber}`;

  return (
    <footer className="fm-footer atelier-footer" role="contentinfo">
      <div className="footer-inner">
        <div className="atelier-footer-grid">
          <section className="atelier-footer-col atelier-footer-brand" aria-labelledby="footer-brand-title">
            <Link href="/" className="footer-logo logo-link" aria-label="A Chapter home">
              <BrandLogo variant="light" />
            </Link>
            <h2 className="atelier-footer-title" id="footer-brand-title">BOTANICAL ARTWARE ATELIER</h2>
            <p className="atelier-footer-copy">
              Preserved botanical keepsakes paired with Smart QR Memory Vault.
              Handcrafted in Surabaya, Indonesia.
            </p>
          </section>

          <nav className="atelier-footer-col" aria-label="Navigasi">
            <h2 className="atelier-footer-title">NAVIGASI</h2>
            <ul className="atelier-footer-links">
              <li><Link href="/shop">The Chapters · Katalog</Link></li>
              <li><Link href="/smart-qr-vault">Smart QR Memory Vault</Link></li>
              <li><Link href="/pre-order">Pre-Order Karya</Link></li>
              <li><Link href="/cek-pesanan">Cek Status Pesanan</Link></li>
            </ul>
          </nav>

          <section className="atelier-footer-col" aria-labelledby="footer-concierge-title">
            <h2 className="atelier-footer-title" id="footer-concierge-title">CONCIERGE &amp; STUDIO</h2>
            <ul className="atelier-footer-links">
              <li><a href={conciergeUrl} target="_blank" rel="noopener noreferrer">WhatsApp Concierge</a></li>
              <li><a href="mailto:Kontakgaluh11@gmail.com">Kontakgaluh11@gmail.com</a></li>
              <li><span>Mon – Sat, 09.00 – 18.00 · Surabaya</span></li>
            </ul>
          </section>
        </div>

        <div className="atelier-footer-bottom">
          <span>© 2026 A Chapter Atelier. All Rights Reserved.</span>
          <span className="atelier-footer-colophon">Preserved for Eternity · Surabaya, Indonesia</span>
        </div>
      </div>
    </footer>
  );
}
