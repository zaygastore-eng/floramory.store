import { useEffect, useState, useRef, type DragEvent, type ChangeEvent, type FormEvent } from "react";
import BrandLogo from "@/components/BrandLogo";
import VaultExperience from "@/pages/VaultExperience";
import { fetchVaultSetup, saveVaultSetup, uploadVaultMedia, type PreOrder } from "@/lib/api";
import { classifyMedia, parseSpotifyEmbedUrl, parseYouTubeEmbedUrl, parseGoogleDriveEmbedUrl } from "@/lib/media";
import { compressVaultPhoto, formatBytes, type CompressedImageResult } from "@/lib/imageCompression";
import { applyNoIndexMeta } from "@/lib/seo";
import { pageUrl } from "@/lib/site";

export default function VaultSetup() {
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<PreOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  // Content states
  const [personalMessage, setPersonalMessage] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
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
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    photo: { percent: number; loaded: number; total: number };
    audio: { percent: number; loaded: number; total: number };
    video: { percent: number; loaded: number; total: number };
  }>({
    photo: { percent: 0, loaded: 0, total: 0 },
    audio: { percent: 0, loaded: 0, total: 0 },
    video: { percent: 0, loaded: 0, total: 0 },
  });
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [saved, setSaved] = useState(false);
  const [vaultLocked, setVaultLocked] = useState(false);
  const [vaultExpired, setVaultExpired] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [photoDragActive, setPhotoDragActive] = useState(false);
  const [compressingPhoto, setCompressingPhoto] = useState(false);
  const [photoCompression, setPhotoCompression] = useState<CompressedImageResult | null>(null);

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
        if (!active) return;
        if (!result.ok || !result.order) {
          setVaultExpired(Boolean(result.vaultExpired));
          setPageError(result.message || "Link tidak valid atau pesanan tidak ditemukan.");
          return;
        }
        setOrder(result.order);
        setVaultLocked(Boolean(result.vaultLocked));
        setPersonalMessage(result.order.personal_message || "");
        setPhotoUrl(result.order.foto_vault || "");
        setPhotoPreview(result.order.foto_vault || "");
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
        setVideoUrl(result.order.video_url || "");
        if (result.order.vault_pin) {
          setCustomPin(result.order.vault_pin);
        }
      })
      .catch(error => {
        if (active) setPageError(error instanceof Error ? error.message : "Link tidak valid atau pesanan tidak ditemukan.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    return () => {
      if (photoPreview.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

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

  const uploadFile = async (file: File, type: "photo" | "audio" | "video") => {
    const isPhoto = type === "photo";
    const isAudio = type === "audio";
    const isVideo = type === "video";
    const setUploading = isPhoto ? setUploadingPhoto : isAudio ? setUploadingAudio : setUploadingVideo;
    const setPreview = isPhoto ? setPhotoPreview : isAudio ? setAudioPreview : setVideoPreview;
    const setUrl = isPhoto ? setPhotoUrl : isAudio ? setAudioUrl : setVideoUrl;
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
      setCompressingPhoto(true);
      setPhotoCompression(null);
      try {
        const compressed = await compressVaultPhoto(file);
        fileToUpload = compressed.file;
        if (compressed.didCompress) setPhotoCompression(compressed);
      } finally {
        setCompressingPhoto(false);
      }
      if (fileToUpload.size > maxSize) {
        setUploadError("Foto masih terlalu besar setelah dioptimalkan. Gunakan foto dengan ukuran lebih kecil.");
        return;
      }
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setUploading(true);
    setUploadProgress(prev => ({
      ...prev,
      [type]: { percent: 0, loaded: 0, total: fileToUpload.size },
    }));

    try {
      const url = await uploadVaultMedia(orderId, type, fileToUpload, (progress) => {
        setUploadProgress(prev => ({
          ...prev,
          [type]: {
            percent: progress.percent,
            loaded: progress.loadedBytes,
            total: progress.totalBytes,
          },
        }));
      });
      // Cache-buster: path storage bersifat tetap (polaroid.webp, video.mp4, dst).
      // Tanpa parameter unik, browser/CDN akan menampilkan berkas lama saat pelanggan mengganti media.
      const freshUrl = /^https?:/i.test(url)
        ? `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`
        : url;
      setUrl(freshUrl);
      setPreview(freshUrl);
      if (isAudio) {
        const audio = new Audio(freshUrl);
        audio.addEventListener("loadedmetadata", () => {
          if (Number.isFinite(audio.duration)) setAudioDuration(Math.round(audio.duration));
        }, { once: true });
      }
    } catch (error) {
      setPreview(isPhoto ? photoUrl : isAudio ? audioUrl : videoUrl);
      setUploadError(error instanceof Error ? error.message : "Gagal mengunggah file.");
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void uploadFile(file, "photo");
    event.target.value = "";
  };

  const handleDropPhoto = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setPhotoDragActive(false);
    const file = event.dataTransfer.files[0];
    if (file) void uploadFile(file, "photo");
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

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!orderId || saving) return;
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
        foto_vault: photoUrl,
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
  const letterInitial = personalMessage.trim().charAt(0) || "A";
  const letterRest = personalMessage.trim().slice(1) || "Tuliskan isi surat...";

  return (
    <main className="vault-setup-page">
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
            </div>

            <form onSubmit={handleSave} className="vault-setup-form">
              {/* CARD 1: UPLOAD POLAROID PHOTOS */}
              <section className="vault-setup-card">
                <div className="card-step-badge">STEP 01</div>
                <h2 className="vault-setup-card-title">Upload Polaroid Photos</h2>
                <p className="vault-setup-card-sub">
                  Pilih momen berharga yang akan dicetak dalam gaya polaroid digital dengan kertas linen bertekstur.
                </p>

                <label
                  htmlFor="vault-photo-input"
                  onDragOver={e => {
                    e.preventDefault();
                    if (!uploadingPhoto && !compressingPhoto) setPhotoDragActive(true);
                  }}
                  onDragEnter={e => {
                    e.preventDefault();
                    if (!uploadingPhoto && !compressingPhoto) setPhotoDragActive(true);
                  }}
                  onDragLeave={e => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                      setPhotoDragActive(false);
                    }
                  }}
                  onDrop={handleDropPhoto}
                  className={`vault-drop-zone${photoDragActive ? " is-dragging" : ""}`}
                >
                  <span className="drop-icon">📷</span>
                  <strong className="drop-title">
                    {compressingPhoto
                      ? "Mengoptimalkan foto..."
                      : uploadingPhoto
                        ? "Sedang mengunggah foto..."
                        : "Sentuh untuk memilih foto atau seret ke sini"}
                  </strong>
                  <span className="drop-hint">Format JPG, PNG, atau WebP · Maksimal 10 MB · otomatis dioptimalkan</span>
                  <input
                    id="vault-photo-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoChange}
                    disabled={uploadingPhoto || compressingPhoto}
                    style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
                  />
                </label>

                {uploadingPhoto && (
                  <div className="vault-upload-progress-box">
                    <div className="vault-upload-progress-top">
                      <span>Mengunggah Foto...</span>
                      <span>{uploadProgress.photo.percent}%</span>
                    </div>
                    <div className="vault-upload-progress-bar-bg">
                      <div
                        className="vault-upload-progress-bar-fill"
                        style={{ width: `${uploadProgress.photo.percent}%` }}
                      />
                    </div>
                    <div className="vault-upload-progress-sub">
                      <span>{(uploadProgress.photo.loaded / (1024 * 1024)).toFixed(1)} MB / {(uploadProgress.photo.total / (1024 * 1024)).toFixed(1)} MB</span>
                      <span>Mohon tunggu sebentar...</span>
                    </div>
                  </div>
                )}

                {!uploadingPhoto && (photoPreview || photoUrl) && (
                  <span className="vault-upload-success-badge" role="status">
                    ✓ Foto polaroid tersimpan
                    {photoCompression && (
                      <span className="vault-compress-savings">
                        {formatBytes(photoCompression.originalBytes)} → {formatBytes(photoCompression.compressedBytes)}
                      </span>
                    )}
                  </span>
                )}

                {photoPreview && (
                  <div className="vault-setup-photo-preview">
                    <div className="folio-polaroid-frame" style={{ maxWidth: "260px", margin: "1.5rem auto 0" }}>
                      <img src={photoPreview} alt="Pratinjau Polaroid" style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover" }} />
                      <p className="folio-polaroid-script" style={{ fontSize: "1.1rem", marginTop: "8px" }}>
                        A moment kept close
                      </p>
                    </div>
                  </div>
                )}
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
                          <span>{uploadProgress.audio.percent}%</span>
                        </div>
                        <div className="vault-upload-progress-bar-bg">
                          <div
                            className="vault-upload-progress-bar-fill"
                            style={{ width: `${uploadProgress.audio.percent}%` }}
                          />
                        </div>
                        <div className="vault-upload-progress-sub">
                          <span>{(uploadProgress.audio.loaded / (1024 * 1024)).toFixed(1)} MB / {(uploadProgress.audio.total / (1024 * 1024)).toFixed(1)} MB</span>
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
                          height="152"
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
                          <span>{uploadProgress.video.percent}%</span>
                        </div>
                        <div className="vault-upload-progress-bar-bg">
                          <div
                            className="vault-upload-progress-bar-fill"
                            style={{ width: `${uploadProgress.video.percent}%` }}
                          />
                        </div>
                        <div className="vault-upload-progress-sub">
                          <span>{(uploadProgress.video.loaded / (1024 * 1024)).toFixed(1)} MB / {(uploadProgress.video.total / (1024 * 1024)).toFixed(1)} MB</span>
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

              {/* CARD 3: WRITE THE SECRET LETTER */}
              <section className="vault-setup-card">
                <div className="card-step-badge">STEP 03</div>
                <h2 className="vault-setup-card-title">Write The Secret Letter</h2>
                <p className="vault-setup-card-sub">
                  Surat ini akan dirender dengan huruf inisial drop-cap bergaya manuskrip kuno pada kertas perkamen linen.
                </p>

                <textarea
                  id="vault-letter-input"
                  className="form-textarea vault-setup-textarea"
                  rows={6}
                  maxLength={2000}
                  value={personalMessage}
                  onChange={e => setPersonalMessage(e.target.value)}
                  placeholder="Tuliskan kata-kata tulus dari lubuk hati Anda..."
                />
                <span className="char-counter">{personalMessage.length} / 2000 karakter</span>

                {/* Drop-cap live preview */}
                <div className="letter-dropcap-preview">
                  <span className="preview-label">LIVE PARCHMENT PREVIEW:</span>
                  <div className="preview-body">
                    <span className="vault-drop-cap">{letterInitial}</span>
                    <p className="preview-text">{letterRest}</p>
                  </div>
                  <div className="preview-signoff">
                    With all my love, always yours, <strong>{order.sender_name || "You"}</strong>
                  </div>
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
                  disabled={saving || uploadingPhoto || uploadingAudio || uploadingVideo || compressingPhoto}
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
                  disabled={saving || uploadingPhoto || uploadingAudio || uploadingVideo || compressingPhoto}
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
                  foto_vault: photoPreview || photoUrl,
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
