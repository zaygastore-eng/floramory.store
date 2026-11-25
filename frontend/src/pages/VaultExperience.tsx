import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRoute } from "wouter";
import {
  fetchVaultPreview,
  fetchWhatsAppNumber,
  openVault,
  getVaultAudioUrl,
  type Product,
} from "@/lib/api";
import { resolveVaultMedia } from "@/lib/media";
import { normalizeWhatsApp } from "@/lib/site";
import { applyProductMeta, applyNoIndexMeta } from "@/lib/seo";
import {
  getPhotoboothTheme,
  normalizeLetterStyle,
  resolveVaultCelebration,
  vaultMomentTitle,
} from "@/lib/vaultDesign";
import VaultStoryExperience, { type VaultStorySkin } from "@/components/VaultStoryExperience";

const WA_FALLBACK = "6285235242425";

export default function VaultExperience({
  params,
  productIdOverride,
  previewData,
}: {
  params?: { id?: string };
  productIdOverride?: string;
  previewData?: Partial<Product>;
}) {
  const [, matchVault] = useRoute("/vault/:id");
  const [, matchV] = useRoute("/v/:id");
  const queryParamId = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("id") || ""
    : "";

  const vaultId = productIdOverride || params?.id || matchVault?.id || matchV?.id || queryParamId;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(!previewData);
  const [error, setError] = useState(false);
  const [waNumber, setWaNumber] = useState(WA_FALLBACK);

  // PIN Unlock state
  const [vaultUnlocked, setVaultUnlocked] = useState(Boolean(previewData));
  const [pinDigits, setPinDigits] = useState<string[]>(() => Array(6).fill(""));
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMessage, setPinMessage] = useState("");
  const [pinLocked, setPinLocked] = useState(false);
  const pinInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const celebration = resolveVaultCelebration(product);
  const isCelebration = celebration.isCelebration;

  useEffect(() => {
    if (previewData) {
      setProduct({
        id: "preview",
        nama_produk: previewData.nama_produk || "The Botanical Keepsake",
        tier: previewData.tier || "classic",
        harga: previewData.harga || "350000",
        deskripsi: previewData.deskripsi || "",
        foto_produk: previewData.foto_produk || "",
        bunga: previewData.bunga || "Hydrangea macrophylla × Gypsophila paniculata",
        bahan: previewData.bahan || "UV Bio-Epoxy",
        ukuran: previewData.ukuran || "15x20 cm",
        nama_pembeli: previewData.nama_pembeli || "You",
        dari: previewData.dari || "Someone Special",
        pesan_personal: previewData.pesan_personal || "",
        foto_qr: previewData.foto_qr || "",
        audio_url: previewData.audio_url || "",
        audio_durasi: previewData.audio_durasi || 0,
        video_url: previewData.video_url || "",
        foto_vault: previewData.foto_vault || "",
        vault_photos: previewData.vault_photos || [],
        vault_photobooth_theme: previewData.vault_photobooth_theme || "",
        vault_letter_style: previewData.vault_letter_style || {},
        vault_moment: previewData.vault_moment || null,
        vault_moment_label: previewData.vault_moment_label || "",
        vault_skin: previewData.vault_skin || "",
        vault_hook_id: previewData.vault_hook_id || "",
        vault_audio_message: previewData.vault_audio_message || "",
        is_catalog: false,
      });
      setVaultUnlocked(true);
      setLoading(false);
      return;
    }

    if (!vaultId) {
      setError(true);
      setLoading(false);
      return;
    }

    let active = true;

    fetchWhatsAppNumber().then((num) => {
      if (active) setWaNumber(normalizeWhatsApp(num) || WA_FALLBACK);
    });

    const tokenKey = (id: string) => `fm_vault_token_${id}`;

    const loadVault = async () => {
      const preview = await fetchVaultPreview(vaultId);
      if (!active) return;
      if (!preview) {
        setError(true);
        return;
      }

      let current = preview.product;
      setProduct(current);

      applyProductMeta({
        id: current.id,
        nama_produk: `${current.nama_pembeli ? `Memoir untuk ${current.nama_pembeli}` : current.nama_produk} — A Chapter Memory Vault`,
        deskripsi: "A secret digital chapter preserved in eternal botanical form.",
        imageUrl: current.foto_vault || current.foto_produk,
      });
      applyNoIndexMeta(document.title);

      if (preview.unlocked) {
        setVaultUnlocked(true);
        return;
      }

      let savedToken = "";
      try {
        savedToken = sessionStorage.getItem(tokenKey(current.id)) || "";
      } catch {
        savedToken = "";
      }
      if (!savedToken) return;

      const opened = await openVault(current.id, { token: savedToken });
      if (!active) return;
      if (opened.ok && opened.product) {
        current = opened.product;
        setProduct(current);
        setVaultUnlocked(true);
        if (opened.token) {
          try {
            sessionStorage.setItem(tokenKey(current.id), opened.token);
          } catch {
            // storage tidak tersedia: tetap tampilkan konten sesi ini
          }
        }
        return;
      }
      try {
        sessionStorage.removeItem(tokenKey(current.id));
      } catch {
        // ignore
      }
    };

    loadVault()
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [vaultId, previewData]);

  const handlePinDigitChange = (index: number, val: string) => {
    const digit = val.slice(-1);
    const updated = [...pinDigits];
    updated[index] = digit;
    setPinDigits(updated);
    setPinMessage("");

    if (digit && index < 5) {
      pinInputRefs.current[index + 1]?.focus();
    }
  };

  const handlePinPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const updated = [...pinDigits];
    for (let i = 0; i < pasted.length; i++) {
      updated[i] = pasted[i];
    }
    setPinDigits(updated);
    pinInputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    const pin = pinDigits.join("");
    if (!/^\d{4,6}$/.test(pin)) return;

    setPinBusy(true);
    setPinMessage("");
    setPinLocked(false);

    try {
      const res = await openVault(product.id, { pin });
      if (!res.ok || !res.verified) {
        setPinMessage(res.message || "PIN rahasia tidak sesuai. Periksa kartu ucapan.");
        setPinLocked(Boolean(res.locked));
        return;
      }
      if (res.product) setProduct(res.product);
      if (res.token) {
        try {
          sessionStorage.setItem(`fm_vault_token_${product.id}`, res.token);
        } catch {
          // storage tidak tersedia: konten tetap tampil untuk sesi ini
        }
      }
      setVaultUnlocked(true);
    } catch (err) {
      setPinMessage(err instanceof Error ? err.message : "Terjadi kesalahan saat memeriksa PIN.");
    } finally {
      setPinBusy(false);
    }
  };

  const photos = useMemo(() => {
    const savedVaultPhotos = (product?.vault_photos || []).filter(
      (url) => Boolean(url && url.trim())
    );
    const list: string[] = [];
    if (savedVaultPhotos.length > 0) {
      list.push(...savedVaultPhotos);
    } else if (product?.foto_vault && product.foto_vault.trim()) {
      list.push(product.foto_vault.trim());
    }
    if (list.length === 0 && product?.foto_produk && product.foto_produk.trim()) {
      list.push(product.foto_produk.trim());
    }
    if (list.length === 0) {
      list.push("/opengraph.jpg");
    }
    return list;
  }, [product]);

  if (loading) {
    return (
      <div className="vault-memoir-loading public-v2">
        <div className="vault-wax-seal-hero pulse" aria-hidden="true">
          <span className="wax-seal-circle">
            <img src="/a-chapter-logo-light.png" alt="" className="wax-seal-logo-img" />
          </span>
        </div>
        <p className="vault-loading-text">Membuka Brankas Memoar Rahasia...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="vault-memoir-wrapper public-v2">
        <div className="vault-memoir-container" style={{ textAlign: "center" }}>
          <div className="vault-wax-seal-hero" aria-hidden="true">
            <span className="wax-seal-circle">✦</span>
          </div>
          <h1 className="vault-hero-error-title" style={{ marginTop: "1.25rem" }}>Brankas Tidak Ditemukan</h1>
          <p className="vault-hero-dedication" style={{ margin: "1rem auto 2rem" }}>
            Kode QR ini mungkin sudah kedaluwarsa atau belum dikonfigurasi oleh pengirim.
          </p>
          <a
            href={`https://wa.me/${waNumber}?text=${encodeURIComponent("Halo A Chapter Concierge, saya membutuhkan bantuan terkait QR Memory Vault.")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hero-cta hero-cta-primary"
          >
            Hubungi Concierge WhatsApp →
          </a>
        </div>
      </div>
    );
  }

  const { audioMedia, videoMedia } = resolveVaultMedia(product.audio_url, product.video_url);
  const hasCustomLetter = Boolean(product.pesan_personal && product.pesan_personal.trim());
  const letterBody = hasCustomLetter
    ? product.pesan_personal
    : "Setiap bunga A Chapter dirangkai untuk menyimpan kenangan abadi. Karya seni botani ini diawetkan dengan cermat di laboratorium agar keindahan dan ketulusan momen istimewa Anda tetap mekar selamanya.";

  const recipient = product.nama_pembeli || "kamu";
  const sender = product.dari || "seseorang yang menyayangi kamu";
  const moment = celebration.moment;
  const storySkin: VaultStorySkin = isCelebration ? celebration.skin.id : "atelier";
  const storyEyebrow = isCelebration
    ? moment?.eyebrow || "SEBUAH MOMEN SPESIAL"
    : "A SECRET CHAPTER PRESERVED";
  const storyTitle = isCelebration && moment
    ? vaultMomentTitle(moment, recipient, celebration.label)
    : product.nama_pembeli
      ? `Memoar untuk ${product.nama_pembeli}`
      : "Babak Kenangan Abadi";

  const stripTheme = getPhotoboothTheme(product.vault_photobooth_theme);
  const letterStyle = normalizeLetterStyle(product.vault_letter_style);

  const audioSrcResolved =
    audioMedia.type !== "spotify" && audioMedia.isAudio && audioMedia.url
      ? getVaultAudioUrl(audioMedia.url)
      : "";

  const audioQuote = product.vault_audio_message?.trim()
    ? product.vault_audio_message.trim()
    : audioMedia.type === "spotify"
      ? product.pesan_personal?.trim() || "Lagu yang dipilih khusus untuk mewakili setiap rasa yang tak sempat terucap."
      : "Dengarkan dengan saksama suara yang dirangkai untuk menemani babak terindah hidupmu.";

  const pinCard = (
    <div className={`vault-pin-card${isCelebration ? " celebration-pin-card" : ""}`} role="dialog" aria-label="Verifikasi PIN Brankas">
      <div className="vault-pin-icon" aria-hidden="true">🔒</div>
      <h2 className="vault-pin-heading">Brankas Memori Terkunci</h2>
      <p className="vault-pin-desc">
        {isCelebration
          ? `Masukkan 6 digit PIN dari kartu ucapan fisik untuk membuka ${moment?.name.toLowerCase() || "momen"} yang disiapkan ${sender}.`
          : "Karya botani ini membawa pesan pribadi rahasia. Masukkan 6 digit PIN dari kartu ucapan fisik untuk membuka memori Anda."}
      </p>

      <form onSubmit={handleVerifyPin} className="vault-pin-form">
        <div className="vault-pin-inputs">
          {Array.from({ length: 6 }, (_, i) => (
            <input
              key={i}
              ref={el => { pinInputRefs.current[i] = el; }}
              type="tel"
              inputMode="numeric"
              maxLength={1}
              className="vault-pin-digit"
              value={pinDigits[i]}
              onChange={e => handlePinDigitChange(i, e.target.value)}
              onKeyDown={e => {
                if (e.key === "Backspace" && !pinDigits[i] && i > 0) {
                  pinInputRefs.current[i - 1]?.focus();
                }
              }}
              onPaste={handlePinPaste}
              aria-label={`Digit PIN ke-${i + 1}`}
            />
          ))}
        </div>

        {pinMessage && (
          <p role="alert" className={`vault-pin-message${pinLocked ? " locked" : ""}`}>
            {pinMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={pinBusy || pinDigits.filter(Boolean).length < (isCelebration ? 6 : 4)}
          className="hero-cta hero-cta-primary vault-pin-submit"
        >
          {pinBusy ? "Memverifikasi..." : "BUKA BRANKAS MEMORI →"}
        </button>

        <a
          href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Halo A Chapter, kartu kado saya untuk produk ID ${product.id} tidak terbaca. Mohon bantuan PIN.`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="vault-pin-help-link"
        >
          PIN tidak terbaca atau hilang? Bantuan WhatsApp
        </a>
      </form>
    </div>
  );

  if (!vaultUnlocked) {
    return (
      <div
        className={`vault-memoir-wrapper public-v2 vault-experience${isCelebration ? " is-celebration" : " is-archive"}`}
        data-skin={isCelebration ? celebration.skin.id : undefined}
        data-moment={moment?.id}
        data-hook={isCelebration ? celebration.hook.id : undefined}
      >
        <div className="vault-celebration-shell">
          <header className="celebration-hero">
            <span className="celebration-eyebrow">{storyEyebrow}</span>
            <h1 className="celebration-script">{storyTitle}</h1>
            <p className="celebration-for">UNTUK {recipient}</p>
            <p className="celebration-from">Disiapkan oleh {sender}</p>
          </header>
          {pinCard}
          <p className="celebration-footnote">
            A Chapter Botanical Atelier · PIN fisik ada di dalam boks kado
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`vault-memoir-wrapper public-v2 vault-experience is-story-mode${isCelebration ? " is-celebration" : " is-archive"}`}
      data-skin={isCelebration ? celebration.skin.id : undefined}
      data-moment={moment?.id}
      data-hook={isCelebration ? celebration.hook.id : undefined}
    >
      <VaultStoryExperience
        mode="vault"
        recipient={recipient}
        sender={sender}
        eyebrow={storyEyebrow}
        title={storyTitle}
        subtitle={
          isCelebration && moment?.note
            ? `${moment.note} Disimpan oleh ${sender}.`
            : `Disimpan selamanya oleh ${sender} bersama karya botani abadi ini.`
        }
        skin={storySkin}
        hookId={isCelebration ? celebration.hook.id : null}
        audioMedia={audioMedia}
        audioSrcResolved={audioSrcResolved}
        audioDuration={product.audio_durasi}
        audioQuote={audioQuote}
        letterBody={letterBody}
        letterStyle={letterStyle}
        hasCustomLetter={hasCustomLetter}
        photos={photos}
        photoboothTheme={stripTheme}
        videoMedia={videoMedia}
        initialStage="opening"
      />
    </div>
  );
}
