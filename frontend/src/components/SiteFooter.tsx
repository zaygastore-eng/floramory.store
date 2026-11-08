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
              <BrandLogo />
            </Link>
            <h2 className="atelier-footer-title" id="footer-brand-title">BOTANICAL ARTWARE ATELIER</h2>
            <p className="atelier-footer-copy">
              Atelier of Botanical Keepsakes &amp; Smart Memory Vault.
              Handcrafted in Surabaya, East Java, Indonesia.
            </p>
            <span className="atelier-footer-location">Surabaya &amp; East Java, ID</span>
          </section>

          <nav className="atelier-footer-col" aria-label="Collections">
            <h2 className="atelier-footer-title">COLLECTIONS</h2>
            <ul className="atelier-footer-links">
              <li><Link href="/#chapters">The Chapters · Framed Keepsakes</Link></li>
              <li><Link href="/#pesan">Bespoke Commission</Link></li>
            </ul>
          </nav>

          <nav className="atelier-footer-col" aria-label="Technology and privacy">
            <h2 className="atelier-footer-title">TECHNOLOGY &amp; PRIVACY</h2>
            <ul className="atelier-footer-links">
              <li><Link href="/smart-qr-vault">Smart QR Memory Vault</Link></li>
              <li><Link href="/smart-qr-vault#privasi">Private URL &amp; Optional PIN</Link></li>
              <li><Link href="/smart-qr-vault#privasi">Zero-Subscription Cloud Hosting</Link></li>
              <li><Link href="/smart-qr-vault#cara-kerja">Camera-Direct Access</Link></li>
            </ul>
          </nav>

          <section className="atelier-footer-col" aria-labelledby="footer-concierge-title">
            <h2 className="atelier-footer-title" id="footer-concierge-title">CONCIERGE &amp; STUDIO</h2>
            <ul className="atelier-footer-links">
              <li><a href={conciergeUrl} target="_blank" rel="noopener noreferrer">WhatsApp: +62 852-3524-2425</a></li>
              <li><a href="mailto:Kontakgaluh11@gmail.com">Email: Kontakgaluh11@gmail.com</a></li>
              <li><span>Mon – Sat, 09.00 – 18.00</span></li>
              <li><span>Surabaya Studio Atelier</span></li>
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
