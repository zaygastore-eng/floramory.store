import { useEffect, useState, useRef, type DragEvent, type ChangeEvent, type FormEvent } from "react";
import BrandLogo from "@/components/BrandLogo";
import VaultExperience from "@/pages/VaultExperience";
import { fetchVaultSetup, saveVaultSetup, uploadVaultMedia, type PreOrder } from "@/lib/api";
import { classifyMedia, parseSpotifyEmbedUrl, parseYouTubeEmbedUrl, parseGoogleDriveEmbedUrl } from "@/lib/media";
import { compressVaultPhoto, formatBytes, type CompressedImageResult } from "@/lib/imageCompression";
import { applyNoIndexMeta } from "@/lib/seo";
import { pageUrl } from "@/lib/site";
import {
  DEFAULT_LETTER_STYLE,
  DEFAULT_PHOTOBOOTH_THEME,
  LETTER_FONT_OPTIONS,
  LETTER_INK_TONES,
  LETTER_SIZE_OPTIONS,
  MAX_VAULT_PHOTOS,
  PHOTOBOOTH_THEMES,
  dpStatusLabel,
  getPhotoboothTheme,
  letterStyleToCss,
  normalizeLetterStyle,
  normalizePhotoboothTheme,
  type LetterAlignId,
  type LetterFontId,
  type LetterSizeId,
  type PhotoboothThemeId,
  type VaultLetterStyle,
} from "@/lib/vaultDesign";

interface PhotoSlot {
  url: string;
  preview: string;
}

interface SlotProgress {
  percent: number;
  loaded: number;
  total: number;
}

function emptyPhotoSlots(): PhotoSlot[] {
  return Array.from({ length: MAX_VAULT_PHOTOS }, () => ({ url: "", preview: "" }));
}

export default function VaultSetup() {
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<PreOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [dpRequired, setDpRequired] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Content states
  const [personalMessage, setPersonalMessage] = useState("");
  const [photoSlots, setPhotoSlots] = useState<PhotoSlot[]>(emptyPhotoSlots);
  const [photoboothTheme, setPhotoboothTheme] = useState<PhotoboothThemeId>(DEFAULT_PHOTOBOOTH_THEME);
  const [letterStyle, setLetterStyle] = useState<VaultLetterStyle>(DEFAULT_LETTER_STYLE);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioPreview, setAudioPreview] = useState("");
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioSource, setAudioSource] = useState<"file" | "record" | "spotify">("file");
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoPreview, setVideoPreview] = useState("");
  const [videoSource, setVideoSource] = useState<"file" | "youtube">("file");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [customPin, setCustomPin] = useState("");

  // Browser voice recorder state
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Upload & Save status
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadingPhotoSlot, setUploadingPhotoSlot] = useState<number | null>(null);
  const [compressingSlot, setCompressingSlot] = useState<number | null>(null);
  const [slotProgress, setSlotProgress] = useState<Record<number, SlotProgress>>({});
  const [photoCompression, setPhotoCompression] = useState<CompressedImageResult | null>(null);
  const [audioProgress, setAudioProgress] = useState<SlotProgress>({ percent: 0, loaded: 0, total: 0 });
  const [videoProgress, setVideoProgress] = useState<SlotProgress>({ percent: 0, loaded: 0, total: 0 });
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [saved, setSaved] = useState(false);
  const [vaultLocked, setVaultLocked] = useState(false);
  const [vaultExpired, setVaultExpired] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [photoDragSlot, setPhotoDragSlot] = useState<number | null>(null);

  const photos = photoSlots.map(slot => slot.url).filter(Boolean);
  const primaryPhotoPreview = photoSlots[0]?.preview || photoSlots[0]?.url || "";
  const activeTheme = getPhotoboothTheme(photoboothTheme);

  const applyOrder = (result: Awaited<ReturnType<typeof fetchVaultSetup>>) => {
    if (!result.ok || !result.order) {
      setVaultExpired(Boolean(result.vaultExpired));
      setPageError(result.message || "Link tidak valid atau pesanan tidak ditemukan.");
      return;
    }
    setOrder(result.order);
    setVaultLocked(Boolean(result.vaultLocked));
    setDpRequired(Boolean(result.dpRequired));
    setPersonalMessage(result.order.personal_message || "");

    const savedPhotos = Array.isArray(result.order.vault_photos) ? result.order.vault_photos : [];
    const merged = [...savedPhotos];
    if (merged.length === 0 && result.order.foto_vault) merged.push(result.order.foto_vault);
    setPhotoSlots(
      Array.from({ length: MAX_VAULT_PHOTOS }, (_, index) => {
        const url = merged[index] || "";
        return { url, preview: url };
      })
    );
    setPhotoboothTheme(normalizePhotoboothTheme(result.order.vault_photobooth_theme));
    setLetterStyle(normalizeLetterStyle(result.order.vault_letter_style));

    const existingAudioUrl = result.order.audio_url || "";
    if (classifyMedia(existingAudioUrl).type === "spotify") {
      setAudioSource("spotify");
      setSpotifyUrl(existingAudioUrl);
      setAudioUrl("");
      setAudioPreview("");
      setAudioDuration(0);
    } else {
      setAudioUrl(existingAudioUrl);
      setAudioPreview(existingAudioUrl);
      setAudioDuration(result.order.audio_durasi || 0);
    }
    const existingVideoUrl = result.order.video_url || "";
    setVideoUrl(existingVideoUrl);
    setVideoPreview(existingVideoUrl);
    setVideoSource(
      parseYouTubeEmbedUrl(existingVideoUrl) || parseGoogleDriveEmbedUrl(existingVideoUrl)
        ? "youtube"
        : "file"
    );
    if (result.order.vault_pin) {
      setCustomPin(result.order.vault_pin);
    }
  };

  useEffect(() => {
    applyNoIndexMeta("Vault Setup — A Chapter");
    const params = new URLSearchParams(window.location.search);
    const id = params.get("order")?.trim() || params.get("token")?.trim() || params.get("id")?.trim() || "";
    setOrderId(id);
    if (!id) {
      setPageError("Link tidak valid atau pesanan tidak ditemukan.");
      setLoading(false);
      return;
    }

    let active = true;
    fetchVaultSetup(id)
      .then(result => {
        if (active) applyOrder(result);
      })
      .catch(error => {
        if (active) setPageError(error instanceof Error ? error.message : "Link tidak valid atau pesanan tidak ditemukan.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshDpStatus = async () => {
    if (!orderId || refreshing) return;
    setRefreshing(true);
    setUploadError("");
    try {
      const result = await fetchVaultSetup(orderId);
      applyOrder(result);
      if (result.ok && !result.dpRequired) {
        setPageError("");
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Gagal memeriksa status DP.");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    return () => {
      photoSlots.forEach(slot => {
        if (slot.preview.startsWith("blob:")) URL.revokeObjectURL(slot.preview);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (audioPreview.startsWith("blob:")) URL.revokeObjectURL(audioPreview);
    };
  }, [audioPreview]);

  useEffect(() => {
    return () => {
      if (videoPreview.startsWith("blob:")) URL.revokeObjectURL(videoPreview);
    };
  }, [videoPreview]);

  // Audio Recording Handlers with Cross-Browser Compatibility
  const startRecording = async () => {
    setUploadError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setUploadError("Browser ini tidak mendukung perekaman langsung. Gunakan Chrome, Safari, atau Edge versi terbaru.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMime =
        typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/mp4")
              ? "audio/mp4"
              : "";
      const mediaRecorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const actualType = mediaRecorder.mimeType || "audio/webm";
        const cleanType = actualType.split(";")[0];
        const ext = cleanType.includes("mp4") ? "m4a" : "webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: cleanType });
        const file = new File([audioBlob], `voicenote-${Date.now()}.${ext}`, { type: cleanType });
        void uploadFile(file, "audio");
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setUploadError(
          "Izin mikrofon ditolak. Klik ikon 🔒 / mikrofon di address bar browser, pilih \"Izinkan\", lalu muat ulang halaman ini."
        );
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setUploadError("Mikrofon tidak ditemukan. Pastikan perangkat memiliki mikrofon yang aktif.");
      } else {
        setUploadError("Tidak dapat mengakses mikrofon browser. Pastikan izin mikrofon telah aktif.");
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const uploadFile = async (file: File, type: "photo" | "audio" | "video", slot = 1) => {
    const isPhoto = type === "photo";
    const isAudio = type === "audio";
    const isVideo = type === "video";
    const clearUploading = isPhoto ? () => setUploadingPhotoSlot(null) : () => undefined;
    const setPreview = isPhoto ? null : isAudio ? setAudioPreview : setVideoPreview;
    const setUrl = isPhoto ? null : isAudio ? setAudioUrl : setVideoUrl;
    const maxSize = isPhoto ? 10 * 1024 * 1024 : isAudio ? 25 * 1024 * 1024 : 50 * 1024 * 1024;
    const allowedTypes = isPhoto
      ? ["image/jpeg", "image/png", "image/webp"]
      : isAudio
        ? ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/ogg", "audio/wav", "audio/webm"]
        : ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"];

    setUploadError("");
    if (!allowedTypes.includes(file.type) && !allowedTypes.some(t => file.type.startsWith(t.split("/")[0]))) {
      setUploadError(
        isPhoto
          ? "Gunakan foto JPG, PNG, atau WebP."
          : isAudio
            ? "Format audio belum didukung (.mp3, .m4a, .wav, .webm)."
            : "Format video belum didukung (.mp4, .webm, .mov)."
      );
      return;
    }
    if (file.size > maxSize) {
      setUploadError(`Ukuran file maksimal ${isPhoto ? "10 MB" : isAudio ? "25 MB" : "50 MB"}.`);
      return;
    }
    if (!orderId) return;

    // Foto kamera ponsel diperkecil & dikompres di browser sebelum diunggah.
    // Ini menghemat kuota pelanggan dan membuat upload jauh lebih cepat.
    let fileToUpload = file;
    if (isPhoto) {
      setCompressingSlot(slot);
      try {
        const compressed = await compressVaultPhoto(file);
        fileToUpload = compressed.file;
        if (compressed.didCompress) setPhotoCompression(compressed);
      } finally {
        setCompressingSlot(null);
      }
      if (fileToUpload.size > maxSize) {
        setUploadError("Foto masih terlalu besar setelah dioptimalkan. Gunakan foto dengan ukuran lebih kecil.");
        return;
      }
    }

    const localPreview = URL.createObjectURL(file);
    if (isPhoto) {
      setPhotoSlots(prev =>
        prev.map((item, index) => (index === slot - 1 ? { ...item, preview: localPreview } : item))
      );
    } else if (setPreview) {
      setPreview(localPreview);
    }

    if (isPhoto) setUploadingPhotoSlot(slot);
    else if (isAudio) setUploadingAudio(true);
    else setUploadingVideo(true);
    const progressSetter = isPhoto
      ? (info: SlotProgress) => setSlotProgress(prev => ({ ...prev, [slot]: info }))
      : isAudio
        ? setAudioProgress
        : setVideoProgress;
    progressSetter({ percent: 0, loaded: 0, total: fileToUpload.size });

    try {
      const url = await uploadVaultMedia(
        orderId,
        type,
        fileToUpload,
        (progress) => {
          progressSetter({
            percent: progress.percent,
            loaded: progress.loadedBytes,
            total: progress.totalBytes,
          });
        },
        isPhoto ? slot : 1
      );
      // Cache-buster: path storage bersifat tetap (polaroid-1.webp, dst).
      // Tanpa parameter unik, browser/CDN akan menampilkan berkas lama saat pelanggan mengganti media.
      const freshUrl = /^https?:/i.test(url)
        ? `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`
        : url;
      if (isPhoto) {
        setPhotoSlots(prev =>
          prev.map((item, index) => (index === slot - 1 ? { url: freshUrl, preview: freshUrl } : item))
        );
      } else if (setUrl) {
        setUrl(freshUrl);
        if (setPreview) setPreview(freshUrl);
      }
      if (isAudio) {
        const audio = new Audio(freshUrl);
        audio.addEventListener("loadedmetadata", () => {
          if (Number.isFinite(audio.duration)) setAudioDuration(Math.round(audio.duration));
        }, { once: true });
      }
    } catch (error) {
      if (isPhoto) {
        setPhotoSlots(prev =>
          prev.map((item, index) => (index === slot - 1 ? { ...item, preview: item.url } : item))
        );
      } else if (setPreview) {
        setPreview(isAudio ? audioUrl : videoUrl);
      }
      setUploadError(error instanceof Error ? error.message : "Gagal mengunggah file.");
    } finally {
      clearUploading();
      if (!isPhoto) {
        if (isAudio) setUploadingAudio(false);
        else setUploadingVideo(false);
      }
    }
  };

  const handlePhotoChange = (slot: number) => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void uploadFile(file, "photo", slot);
    event.target.value = "";
  };

  const handleDropPhoto = (slot: number) => (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setPhotoDragSlot(null);
    const file = event.dataTransfer.files[0];
    if (file) void uploadFile(file, "photo", slot);
  };

  const removePhotoSlot = (slot: number) => {
    setPhotoSlots(prev =>
      prev.map((item, index) => (index === slot - 1 ? { url: "", preview: "" } : item))
    );
  };

  const handleAudioChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void uploadFile(file, "audio");
    event.target.value = "";
  };

  const handleVideoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void uploadFile(file, "video");
    event.target.value = "";
  };

  const handleDropVideo = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) void uploadFile(file, "video");
  };

  const updateLetterStyle = <K extends keyof VaultLetterStyle>(key: K, value: VaultLetterStyle[K]) => {
    setLetterStyle(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!orderId || saving) return;
    if (photos.length === 0) {
      setUploadError("Unggah minimal satu foto untuk photobooth strip kenangan Anda.");
      return;
    }
    if (audioSource === "spotify" && spotifyUrl.trim() && !parseSpotifyEmbedUrl(spotifyUrl)) {
      setUploadError("Periksa kembali link Spotify. Gunakan tautan track, album, atau playlist yang valid.");
      return;
    }
    if (customPin && !/^\d{6}$/.test(customPin)) {
      setUploadError("PIN rahasia harus terdiri dari 6 digit angka.");
      return;
    }

    setSaving(true);
    setUploadError("");
    try {
      const result = await saveVaultSetup(orderId, {
        personal_message: personalMessage,
        foto_vault: photos[0] || "",
        vault_photos: photos,
        vault_photobooth_theme: photoboothTheme,
        vault_letter_style: letterStyle as unknown as Record<string, unknown>,
        audio_url: audioSource === "spotify" ? spotifyUrl.trim() : audioUrl,
        audio_durasi: audioSource === "spotify" ? 0 : audioDuration,
        video_url: videoUrl.trim(),
        vault_pin: customPin.trim(),
      });
      if (!result.ok) {
        if (result.expired) {
          setVaultExpired(true);
          setPageError(result.message);
          return;
        }
        if (result.locked) {
          setVaultLocked(true);
          return;
        }
        if (result.dpRequired) {
          setDpRequired(true);
          return;
        }
        throw new Error(result.message);
      }
      setVaultLocked(true);
      setSaved(true);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Gagal menyimpan Memory Vault.");
    } finally {
      setSaving(false);
    }
  };

  const orderLabel = order?.order_number || order?.id || orderId;
  const spotifyEmbedPreviewUrl = parseSpotifyEmbedUrl(spotifyUrl);
  const isBusy =
    saving ||
    uploadingAudio ||
    uploadingVideo ||
    uploadingPhotoSlot !== null ||
    compressingSlot !== null;

  const whatsappHelpUrl = `https://wa.me/6285235242425?text=${encodeURIComponent(
    `Halo A Chapter Concierge, saya ingin menanyakan status DP 50% untuk pesanan #${orderLabel}.`
  )}`;

  return (
    <main className="vault-setup-page public-v2">
      <div className="vault-setup-container">
        {/* Atelier Header */}
        <header className="vault-setup-header">
          <a href={pageUrl("/")} aria-label="A Chapter" className="logo-link">
            <BrandLogo />
          </a>
          <span className="vault-setup-kicker">ATELIER PRIVATE SENDER CONSOLE</span>
          <h1 className="vault-setup-main-title">Configure Memory Vault</h1>
          <p className="vault-setup-lead">
            Siapkan konten kenangan rahasia yang akan terbuka saat penerima kado memindai micro-chip di dasar karya botani Anda.
          </p>
        </header>

        {loading ? (
          <div className="vault-setup-skeleton" aria-live="polite" aria-busy="true">
            <span className="sr-only">Membuka ruang konfigurasi kenangan atelier...</span>
            {[0, 1, 2].map(card => (
              <section className="vault-skeleton-card" key={card} aria-hidden="true">
                <span className="vault-skeleton-line is-title" />
                <span className="vault-skeleton-line" />
                <span className="vault-skeleton-line is-short" />
                <span className="vault-skeleton-block" />
              </section>
            ))}
          </div>
        ) : pageError || !order ? (
          <section className="vault-setup-card text-center" role="alert">
            <div className="vault-setup-empty-icon" aria-hidden="true">🌿</div>
            <h2 className="vault-setup-card-title">
              {vaultExpired ? "Link Konfigurasi Kedaluwarsa" : "Link Tidak Valid atau Pesanan Dibatalkan"}
            </h2>
            <p className="vault-setup-hint">
              {vaultExpired
                ? "Masa berlaku tautan ini sudah habis. Hubungi kurator A Chapter melalui WhatsApp untuk mendapatkan tautan baru."
                : "Periksa kembali tautan yang dikirimkan oleh atelier A Chapter atau hubungi kurator WhatsApp kami."}
            </p>
            <div style={{ marginTop: "1.5rem" }}>
              <a
                href="https://wa.me/6285235242425"
                target="_blank"
                rel="noopener noreferrer"
                className="hero-cta hero-cta-primary"
              >
                Hubungi Concierge WhatsApp →
              </a>
            </div>
          </section>
        ) : dpRequired ? (
          /* ── DP 50% GATE: konsol terkunci sampai admin memverifikasi ── */
          <section className="vault-setup-card vault-dp-card" role="status">
            <div className="vault-dp-seal" aria-hidden="true">
              <span className="wax-seal-circle">A · C</span>
            </div>
            <span className="vault-dp-kicker">MEMORY VAULT · MENUNGGU VERIFIKASI DP</span>
            <h2 className="vault-setup-card-title vault-dp-title">
              Konsol Kenangan Terkunci Sementara
            </h2>
            <p className="vault-dp-lead">
              Terima kasih, <strong>{order.customer_name || "Sahabat A Chapter"}</strong>. Konsol pengisian
              foto, suara, dan surat rahasia terbuka otomatis setelah atelier memverifikasi{" "}
              <strong>DP 50%</strong> pesanan Anda.
            </p>

            <div className="vault-dp-meta">
              <div>
                <span className="vault-dp-meta-label">NOMOR PESANAN</span>
                <strong>#{orderLabel}</strong>
              </div>
              <div>
                <span className="vault-dp-meta-label">PENERIMA</span>
                <strong>{order.recipient_name || "Penerima Kado"}</strong>
              </div>
              <div>
                <span className="vault-dp-meta-label">STATUS</span>
                <strong>{dpStatusLabel(order.status)}</strong>
              </div>
            </div>

            <ol className="vault-dp-steps">
              <li className="is-done">
                <span className="vault-dp-step-dot" aria-hidden="true">✓</span>
                <div>
                  <strong>Pesanan diterima</strong>
                  <span>Lembar komisi Anda sudah tercatat di arsip atelier.</span>
                </div>
              </li>
              <li className="is-active">
                <span className="vault-dp-step-dot" aria-hidden="true">2</span>
                <div>
                  <strong>Verifikasi DP 50%</strong>
                  <span>Concierge memeriksa bukti transfer Anda (biasanya &lt; 1 × 24 jam).</span>
                </div>
              </li>
              <li>
                <span className="vault-dp-step-dot" aria-hidden="true">3</span>
                <div>
                  <strong>Racik Memory Vault</strong>
                  <span>Photobooth 4-cut, surat renda, suara, dan video memoir.</span>
                </div>
              </li>
              <li>
                <span className="vault-dp-step-dot" aria-hidden="true">4</span>
                <div>
                  <strong>Produksi karya botani</strong>
                  <span>Bunga didehidrasi, QR code dicetak, lalu dikirim ke penerima.</span>
                </div>
              </li>
            </ol>

            <p className="vault-dp-note">
              Simpan tautan halaman ini. Begitu DP diverifikasi, halaman akan terbuka otomatis
              tanpa perlu tautan baru.
            </p>

            {uploadError && (
              <div className="vault-setup-error" role="alert">
                {uploadError}
              </div>
            )}

            <div className="vault-dp-actions">
              <button
                type="button"
                className="hero-cta hero-cta-primary"
                onClick={refreshDpStatus}
                disabled={refreshing}
              >
                {refreshing ? "Memeriksa status..." : "Cek Status DP Sekarang"}
              </button>
              <a
                href={whatsappHelpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hero-cta hero-cta-outline vault-dp-wa"
              >
                Konfirmasi Bukti DP via WhatsApp
              </a>
            </div>
          </section>
        ) : saved || vaultLocked ? (
          <section className="vault-setup-card text-center vault-setup-success-card" role="status">
            <div className="vault-wax-seal-hero" aria-hidden="true" style={{ margin: "0 auto 1.5rem" }}>
              <span className="wax-seal-circle">A · C</span>
            </div>
            <h2 className="vault-setup-card-title" style={{ fontSize: "2rem" }}>Kenangan Berhasil Dikunci</h2>
            <p className="vault-setup-hint" style={{ maxWidth: "480px", margin: "1rem auto 2rem" }}>
              Memoir digital Anda telah aman tersimpan di cloud permanen A Chapter. Kurator kami akan mencetak PIN fisik rahasia pada kartu ucapan di dalam boks kado penerima.
            </p>
            <button
              type="button"
              className="hero-cta hero-cta-primary"
              onClick={() => setPreviewModalOpen(true)}
            >
              [ Pratinjau Tampilan Penerima ]
            </button>
          </section>
        ) : (
          <>
            {/* Order Info Strip */}
            <div className="vault-setup-meta-bar">
              <div>
                <span className="meta-bar-tag">ORDER SPECIMEN</span>
                <strong className="meta-bar-id">#{orderLabel}</strong>
              </div>
              <div>
                <span className="meta-bar-tag">RECIPIENT</span>
                <strong className="meta-bar-name">{order.recipient_name || "Penerima Kado"}</strong>
              </div>
              <div>
                <span className="meta-bar-tag">DP STATUS</span>
                <strong className="meta-bar-name vault-meta-dp">✓ {dpStatusLabel(order.status)}</strong>
              </div>
            </div>

            <form onSubmit={handleSave} className="vault-setup-form">
              {/* CARD 1: PHOTOBOOTH 4-CUT STRIP */}
              <section className="vault-setup-card">
                <div className="card-step-badge">STEP 01</div>
                <h2 className="vault-setup-card-title">Photobooth Memory Strip</h2>
                <p className="vault-setup-card-sub">
                  Unggah hingga 4 momen terbaik, pilih gaya border, dan lihat hasilnya persis seperti
                  strip photobooth yang akan dibuka penerima lewat QR code.
                </p>

                <div className="vault-photobooth">
                  <div className="vault-photobooth-editor">
                    <div className="vault-photobooth-slots">
                      {Array.from({ length: MAX_VAULT_PHOTOS }, (_, index) => {
                        const slot = index + 1;
                        const current = photoSlots[index];
                        const isUploading = uploadingPhotoSlot === slot;
                        const isCompressing = compressingSlot === slot;
                        const progress = slotProgress[slot];
                        return (
                          <div className="vault-photo-slot-wrap" key={slot}>
                            <label
                              htmlFor={`vault-photo-input-${slot}`}
                              onDragOver={e => {
                                e.preventDefault();
                                if (!isUploading && !isCompressing) setPhotoDragSlot(slot);
                              }}
                              onDragEnter={e => {
                                e.preventDefault();
                                if (!isUploading && !isCompressing) setPhotoDragSlot(slot);
                              }}
                              onDragLeave={e => {
                                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                                  setPhotoDragSlot(null);
                                }
                              }}
                              onDrop={handleDropPhoto(slot)}
                              className={`vault-photo-slot${photoDragSlot === slot ? " is-dragging" : ""}${current.preview ? " has-photo" : ""}`}
                            >
                              {current.preview ? (
                                <img src={current.preview} alt={`Foto photobooth ${slot}`} className="vault-photo-slot-img" />
                              ) : (
                                <span className="vault-photo-slot-empty">
                                  <span className="vault-photo-slot-plus" aria-hidden="true">＋</span>
                                  <span>Cut 0{slot}</span>
                                </span>
                              )}

                              {isCompressing && <span className="vault-photo-slot-overlay">Mengoptimalkan…</span>}
                              {isUploading && (
                                <span className="vault-photo-slot-overlay">
                                  {progress ? `${progress.percent}%` : "Mengunggah…"}
                                </span>
                              )}

                              <span className="vault-photo-slot-badge">0{slot}</span>
                              <input
                                id={`vault-photo-input-${slot}`}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={handlePhotoChange(slot)}
                                disabled={isUploading || isCompressing}
                                style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
                              />
                            </label>
                            {current.url && !isUploading && (
                              <button
                                type="button"
                                className="vault-photo-slot-remove"
                                onClick={() => removePhotoSlot(slot)}
                                aria-label={`Hapus foto cut ${slot}`}
                              >
                                Hapus
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="vault-photo-hint-row">
                      <span className="drop-hint">JPG, PNG, atau WebP · Maks. 10 MB per foto · otomatis dioptimalkan</span>
                      {photoCompression && (
                        <span className="vault-compress-savings">
                          {formatBytes(photoCompression.originalBytes)} → {formatBytes(photoCompression.compressedBytes)}
                        </span>
                      )}
                    </div>

                    <div className="vault-theme-block">
                      <span className="vault-toolbar-label">PILIH GAYA BORDER</span>
                      <div className="vault-theme-chips" role="radiogroup" aria-label="Pilih gaya border photobooth">
                        {PHOTOBOOTH_THEMES.map(theme => {
                          const isSelected = photoboothTheme === theme.id;
                          return (
                            <button
                              key={theme.id}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              className={`vault-theme-chip${isSelected ? " is-active" : ""}`}
                              onClick={() => setPhotoboothTheme(theme.id)}
                              style={{
                                backgroundColor: theme.bg,
                                color: theme.text,
                                borderColor: isSelected ? theme.text : theme.border,
                              }}
                            >
                              <span className="vault-theme-dot" style={{ backgroundColor: theme.dot }} />
                              <span>{theme.name}</span>
                              {isSelected && <span aria-hidden="true">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Live strip preview */}
                  <div className="vault-strip-preview-wrap">
                    <div
                      className="vault-strip-preview"
                      style={{
                        backgroundColor: activeTheme.bg,
                        color: activeTheme.text,
                        borderColor: activeTheme.border,
                      }}
                    >
                      <div className="vault-strip-preview-head">
                        <span className="vault-strip-atelier">A CHAPTER ATELIER</span>
                        <span className="vault-strip-edition">ARCHIVAL PHOTOBOOTH · 4 CUTS</span>
                      </div>
                      <div className="vault-strip-preview-grid">
                        {Array.from({ length: MAX_VAULT_PHOTOS }, (_, index) => {
                          const current = photoSlots[index];
                          return (
                            <div className="vault-strip-preview-frame" key={index}>
                              {current.preview ? (
                                <img src={current.preview} alt={`Pratinjau cut ${index + 1}`} className="vault-strip-preview-img" />
                              ) : (
                                <span className="vault-strip-preview-empty">0{index + 1}</span>
                              )}
                              <span className="vault-strip-frame-num" aria-hidden="true">0{index + 1}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="vault-strip-preview-foot">
                        <span className="vault-strip-date">SURABAYA ATELIER · 2026</span>
                        <span className="vault-strip-monogram" aria-hidden="true">A · C</span>
                      </div>
                    </div>
                    <span className="vault-strip-caption">Live preview strip penerima</span>
                  </div>
                </div>
              </section>

              {/* CARD 2: RECORD OR UPLOAD VOICE MEMORY */}
              <section className="vault-setup-card">
                <div className="card-step-badge">STEP 02</div>
                <h2 className="vault-setup-card-title">Record or Upload Voice Memory</h2>
                <p className="vault-setup-card-sub">
                  Suara Anda adalah elemen paling personal. Rekam langsung melalui mikrofon atau unggah file suara.
                </p>

                <div className="vault-audio-toggle-row">
                  <button
                    type="button"
                    className={`audio-toggle-btn${audioSource === "file" ? " active" : ""}`}
                    onClick={() => setAudioSource("file")}
                  >
                    Unggah File Audio
                  </button>
                  <button
                    type="button"
                    className={`audio-toggle-btn${audioSource === "record" ? " active" : ""}`}
                    onClick={() => setAudioSource("record")}
                  >
                    Rekam Langsung di Browser
                  </button>
                  <button
                    type="button"
                    className={`audio-toggle-btn${audioSource === "spotify" ? " active" : ""}`}
                    onClick={() => { setAudioSource("spotify"); setAudioDuration(0); }}
                  >
                    Link Lagu Spotify
                  </button>
                </div>

                {!uploadingAudio && (audioPreview || audioUrl || spotifyUrl.trim()) && (
                  <span className="vault-upload-success-badge" role="status">
                    ✓ Memori suara siap
                  </span>
                )}

                {audioSource === "file" && (
                  <div className="vault-audio-file-box">
                    <label htmlFor="vault-audio-input" className="vault-file-label">
                      {uploadingAudio ? "Mengunggah audio..." : "Pilih Berkas Rekaman (.mp3, .m4a, .wav)"}
                    </label>
                    <input
                      id="vault-audio-input"
                      type="file"
                      accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,audio/wav,audio/webm"
                      onChange={handleAudioChange}
                      disabled={uploadingAudio}
                      className="form-input"
                    />
                    <span className="drop-hint">Format didukung: MP3, M4A, WAV · Maksimal 25 MB</span>

                    {uploadingAudio && (
                      <div className="vault-upload-progress-box">
                        <div className="vault-upload-progress-top">
                          <span>Mengunggah Audio Suara...</span>
                          <span>{audioProgress.percent}%</span>
                        </div>
                        <div className="vault-upload-progress-bar-bg">
                          <div
                            className="vault-upload-progress-bar-fill"
                            style={{ width: `${audioProgress.percent}%` }}
                          />
                        </div>
                        <div className="vault-upload-progress-sub">
                          <span>{(audioProgress.loaded / (1024 * 1024)).toFixed(1)} MB / {(audioProgress.total / (1024 * 1024)).toFixed(1)} MB</span>
                          <span>Mohon jangan tutup halaman...</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {audioSource === "record" && (
                  <div className="vault-browser-recorder">
                    {!recording ? (
                      <button
                        type="button"
                        className="recorder-btn record"
                        onClick={startRecording}
                      >
                        ● Mulai Rekam Suara
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="recorder-btn stop"
                        onClick={stopRecording}
                      >
                        ■ Hentikan &amp; Simpan ({recordingTime}s)
                      </button>
                    )}
                    <p className="drop-hint">
                      {recording ? "Sedang merekam suara Anda... Bicara dengan tenang di dekat mikrofon." : "Tekan tombol di atas untuk merekam langsung tanpa aplikasi tambahan."}
                    </p>
                  </div>
                )}

                {audioSource === "spotify" && (
                  <div className="vault-spotify-box">
                    <input
                      type="url"
                      value={spotifyUrl}
                      onChange={e => setSpotifyUrl(e.target.value)}
                      placeholder="https://open.spotify.com/track/..."
                      className="form-input"
                    />
                    {spotifyEmbedPreviewUrl ? (
                      <>
                        <iframe
                          title="Spotify Preview"
                          src={spotifyEmbedPreviewUrl}
                          width="100%"
                          height="352"
                          className="vault-spotify-embed"
                          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                          style={{ marginTop: "1rem", borderRadius: "8px", border: "none" }}
                        />
                        <a
                          className="spotify-open-link"
                          href={spotifyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Buka langsung di Spotify ↗
                        </a>
                        <p className="drop-hint" style={{ marginTop: "0.75rem" }}>
                          Judul dan nama artis muncul otomatis dari Spotify. Kutipan lirik atau alasan
                          memilih lagu ini akan tampil di bawah pemutar, diambil dari surat personal Anda
                          di bagian bawah halaman.
                        </p>
                      </>
                    ) : spotifyUrl.trim() ? (
                      <p className="drop-hint" style={{ marginTop: "0.75rem" }}>
                        Tautan belum dikenali. Gunakan tautan lagu/album/playlist yang diawali
                        <strong> https://open.spotify.com/</strong> (bukan tautan pendek spotify.link).
                      </p>
                    ) : null}
                  </div>
                )}

                {audioPreview && audioSource !== "spotify" && (
                  <div className="vault-audio-player-preview">
                    <audio
                      controls
                      src={audioPreview}
                      style={{ width: "100%", marginTop: "1rem" }}
                      onLoadedMetadata={e => {
                        const dur = e.currentTarget.duration;
                        if (Number.isFinite(dur)) setAudioDuration(Math.round(dur));
                      }}
                    />
                  </div>
                )}
              </section>

              {/* CARD: VIDEO MEMOIR (OPTIONAL) */}
              <section className="vault-setup-card">
                <div className="card-step-badge">OPTIONAL MEMOIR</div>
                <h2 className="vault-setup-card-title">Video Keepsake (Opsional)</h2>
                <p className="vault-setup-card-sub">
                  Sematkan video kenangan spesial untuk melengkapi rekaman audio Anda. Unggah berkas video (.mp4, .mov, .webm) atau tempel tautan YouTube/Shorts.
                </p>

                <div className="vault-audio-toggle-row">
                  <button
                    type="button"
                    className={`audio-toggle-btn${videoSource === "file" ? " active" : ""}`}
                    onClick={() => setVideoSource("file")}
                  >
                    Unggah Berkas Video
                  </button>
                  <button
                    type="button"
                    className={`audio-toggle-btn${videoSource === "youtube" ? " active" : ""}`}
                    onClick={() => setVideoSource("youtube")}
                  >
                    Link YouTube / Google Drive
                  </button>
                </div>

                {!uploadingVideo && (videoPreview || videoUrl) && (
                  <span className="vault-upload-success-badge" role="status">
                    ✓ Video memoir siap
                  </span>
                )}

                {videoSource === "file" && (
                  <div className="vault-audio-file-box">
                    <label htmlFor="vault-video-input" className="vault-file-label">
                      {uploadingVideo ? "Mengunggah video..." : "Pilih Berkas Video (.mp4, .mov, .webm)"}
                    </label>
                    <input
                      id="vault-video-input"
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
                      onChange={handleVideoChange}
                      disabled={uploadingVideo}
                      className="form-input"
                    />
                    <span className="drop-hint">Format didukung: MP4, MOV (iPhone), WebM · Maksimal 50 MB</span>

                    {uploadingVideo && (
                      <div className="vault-upload-progress-box">
                        <div className="vault-upload-progress-top">
                          <span>Mengunggah Video Kenangan...</span>
                          <span>{videoProgress.percent}%</span>
                        </div>
                        <div className="vault-upload-progress-bar-bg">
                          <div
                            className="vault-upload-progress-bar-fill"
                            style={{ width: `${videoProgress.percent}%` }}
                          />
                        </div>
                        <div className="vault-upload-progress-sub">
                          <span>{(videoProgress.loaded / (1024 * 1024)).toFixed(1)} MB / {(videoProgress.total / (1024 * 1024)).toFixed(1)} MB</span>
                          <span>Mohon jangan tutup halaman saat proses unggah...</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {videoSource === "youtube" && (
                  <div className="vault-spotify-box">
                    <input
                      type="url"
                      value={videoUrl}
                      onChange={e => setVideoUrl(e.target.value)}
                      placeholder="Link YouTube (https://youtu.be/...) atau Google Drive (https://drive.google.com/file/d/...)"
                      className="form-input"
                    />
                    {parseYouTubeEmbedUrl(videoUrl) && (
                      <div style={{ marginTop: "1rem", position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: "8px" }}>
                        <iframe
                          title="YouTube Video Preview"
                          src={parseYouTubeEmbedUrl(videoUrl)!}
                          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    )}
                    {parseGoogleDriveEmbedUrl(videoUrl) && (
                      <div style={{ marginTop: "1rem", position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: "8px" }}>
                        <iframe
                          title="Google Drive Video Preview"
                          src={parseGoogleDriveEmbedUrl(videoUrl)!}
                          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                          allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    )}
                  </div>
                )}

                {(videoPreview || (videoUrl && videoSource === "file")) && (
                  <div className="vault-video-player-preview" style={{ marginTop: "1rem" }}>
                    <video
                      controls
                      playsInline
                      src={videoPreview || videoUrl}
                      style={{ width: "100%", maxHeight: "360px", borderRadius: "10px", background: "#000" }}
                    >
                      Browser Anda tidak mendukung pemutar video.
                    </video>
                  </div>
                )}
              </section>

              {/* CARD 3: WRITE THE SECRET LETTER ON LACE BOARD */}
              <section className="vault-setup-card">
                <div className="card-step-badge">STEP 03</div>
                <h2 className="vault-setup-card-title">Write The Secret Letter</h2>
                <p className="vault-setup-card-sub">
                  Tulis surat langsung di atas papan renda. Atur font, ukuran, perataan, dan warna tinta
                  persis seperti di Word atau Google Docs.
                </p>

                <div className="vault-letter-toolbar" aria-label="Pengaturan gaya tulisan surat">
                  <div className="vault-toolbar-group">
                    <span className="vault-toolbar-label">FONT</span>
                    <div className="vault-toolbar-btn-group">
                      {LETTER_FONT_OPTIONS.map(option => (
                        <button
                          key={option.id}
                          type="button"
                          className={`vault-toolbar-btn${letterStyle.font === option.id ? " is-active" : ""}`}
                          onClick={() => updateLetterStyle("font", option.id as LetterFontId)}
                          style={{ fontFamily: option.stack, fontSize: option.sampleSize }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="vault-toolbar-group">
                    <span className="vault-toolbar-label">UKURAN</span>
                    <div className="vault-toolbar-btn-group">
                      {LETTER_SIZE_OPTIONS.map(option => (
                        <button
                          key={option.id}
                          type="button"
                          className={`vault-toolbar-btn vault-toolbar-btn--size${letterStyle.size === option.id ? " is-active" : ""}`}
                          onClick={() => updateLetterStyle("size", option.id as LetterSizeId)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="vault-toolbar-group">
                    <span className="vault-toolbar-label">GAYA</span>
                    <div className="vault-toolbar-btn-group">
                      <button
                        type="button"
                        className={`vault-toolbar-btn vault-toolbar-btn--icon${letterStyle.bold ? " is-active" : ""}`}
                        onClick={() => updateLetterStyle("bold", !letterStyle.bold)}
                        aria-pressed={letterStyle.bold}
                        title="Tebal"
                      >
                        <strong>B</strong>
                      </button>
                      <button
                        type="button"
                        className={`vault-toolbar-btn vault-toolbar-btn--icon${letterStyle.italic ? " is-active" : ""}`}
                        onClick={() => updateLetterStyle("italic", !letterStyle.italic)}
                        aria-pressed={letterStyle.italic}
                        title="Miring"
                      >
                        <em>I</em>
                      </button>
                      <button
                        type="button"
                        className={`vault-toolbar-btn vault-toolbar-btn--icon${letterStyle.underline ? " is-active" : ""}`}
                        onClick={() => updateLetterStyle("underline", !letterStyle.underline)}
                        aria-pressed={letterStyle.underline}
                        title="Garis bawah"
                      >
                        <u>U</u>
                      </button>
                    </div>
                  </div>

                  <div className="vault-toolbar-group">
                    <span className="vault-toolbar-label">POSISI</span>
                    <div className="vault-toolbar-btn-group">
                      {(["left", "center", "right"] as LetterAlignId[]).map(align => (
                        <button
                          key={align}
                          type="button"
                          className={`vault-toolbar-btn vault-toolbar-btn--icon${letterStyle.align === align ? " is-active" : ""}`}
                          onClick={() => updateLetterStyle("align", align)}
                          aria-pressed={letterStyle.align === align}
                          title={align === "left" ? "Rata kiri" : align === "center" ? "Rata tengah" : "Rata kanan"}
                        >
                          {align === "left" ? "≡" : align === "center" ? "⁞" : "≡"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="vault-toolbar-group">
                    <span className="vault-toolbar-label">TINTA</span>
                    <div className="vault-toolbar-color-group">
                      {LETTER_INK_TONES.map(ink => (
                        <button
                          key={ink.color}
                          type="button"
                          className={`vault-toolbar-color-dot${letterStyle.color === ink.color ? " is-active" : ""}`}
                          style={{ backgroundColor: ink.color }}
                          onClick={() => updateLetterStyle("color", ink.color)}
                          aria-label={`Warna tinta ${ink.name}`}
                          aria-pressed={letterStyle.color === ink.color}
                          title={ink.name}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="vault-lace-board">
                  <img
                    src="/landing/lace-letter-card.webp"
                    alt="Papan renda tempat menulis surat"
                    className="vault-lace-mat"
                    loading="lazy"
                  />
                  <div className="vault-lace-parchment">
                    <textarea
                      id="vault-letter-input"
                      className="vault-lace-textarea"
                      value={personalMessage}
                      onChange={e => setPersonalMessage(e.target.value.slice(0, 2000))}
                      maxLength={2000}
                      placeholder="Tuliskan kata-kata tulus dari lubuk hati Anda..."
                      style={letterStyleToCss(letterStyle, "board")}
                    />
                  </div>
                </div>
                <div className="vault-letter-foot">
                  <span className="char-counter">{personalMessage.length} / 2000 karakter</span>
                  <span className="drop-hint">Ketik langsung di atas perkamen renda — hasilnya sama dengan yang dilihat penerima.</span>
                </div>
              </section>

              {/* OPTIONAL PIN CONFIGURATION */}
              <section className="vault-setup-card">
                <div className="card-step-badge">OPTIONAL SECURITY</div>
                <h2 className="vault-setup-card-title">Secret PIN Protection</h2>
                <p className="vault-setup-card-sub">
                  Atur 6 digit PIN (opsional): Hanya orang yang tahu kode ini yang dapat membuka brankas memori.
                </p>

                <input
                  type="text"
                  maxLength={6}
                  value={customPin}
                  onChange={e => setCustomPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="Contoh: 140226"
                  className="form-input vault-pin-config-input"
                />
                <span className="drop-hint">
                  Jika dikosongkan, sistem akan mengunci dengan PIN acak yang otomatis tertera pada kartu ucapan fisik kado.
                </span>
              </section>

              {/* ERRORS */}
              {uploadError && (
                <div className="vault-setup-error" role="alert">
                  {uploadError}
                </div>
              )}

              {/* ACTIONS: PREVIEW & SAVE */}
              <div className="vault-setup-action-group">
                <button
                  type="button"
                  className="vault-setup-preview-btn"
                  onClick={() => setPreviewModalOpen(true)}
                >
                  [ Preview What Recipient Will See ]
                </button>

                <button
                  type="submit"
                  disabled={isBusy}
                  className="hero-cta hero-cta-primary vault-setup-save-btn"
                >
                  {saving ? "Mengunci Kenangan..." : "KUNCI & SIMPAN BRANKAS MEMORI →"}
                </button>
              </div>

              <div className="vault-mobile-savebar">
                <span>Kenangan siap dikunci?</span>
                <button
                  type="submit"
                  aria-label="Kunci dan simpan brankas memori"
                  disabled={isBusy}
                >
                  {saving ? "Menyimpan..." : "Kunci & Simpan"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      {/* RECIPIENT PREVIEW MODAL */}
      {previewModalOpen && (
        <div
          className="modal-overlay open"
          style={{ zIndex: 400 }}
          onClick={() => setPreviewModalOpen(false)}
        >
          <div
            className="vault-preview-modal-dialog"
            onClick={e => e.stopPropagation()}
          >
            <div className="vault-preview-modal-bar">
              <span>PREVIEW SIMULATION · WHAT RECIPIENT WILL SEE</span>
              <button
                type="button"
                className="vault-preview-close"
                onClick={() => setPreviewModalOpen(false)}
              >
                ✕ Close Preview
              </button>
            </div>
            <div className="vault-preview-content">
              <VaultExperience
                previewData={{
                  nama_pembeli: order?.recipient_name || "Recipient Name",
                  dari: order?.sender_name || "Sender Name",
                  pesan_personal: personalMessage || "Pesan kenangan manis Anda...",
                  foto_vault: primaryPhotoPreview,
                  vault_photos: photos,
                  vault_photobooth_theme: photoboothTheme,
                  vault_letter_style: letterStyle as unknown as Record<string, unknown>,
                  audio_url:
                    audioSource === "spotify"
                      ? spotifyUrl.trim()
                      : audioPreview || audioUrl,
                  audio_durasi: audioDuration,
                  video_url:
                    videoSource === "youtube"
                      ? videoUrl.trim()
                      : videoPreview || videoUrl,
                  bunga: order?.product_name || "Hydrangea macrophylla x Gypsophila paniculata",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
