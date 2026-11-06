import { useEffect, useState, useRef, type DragEvent, type ChangeEvent, type FormEvent } from "react";
import BrandLogo from "@/components/BrandLogo";
import VaultExperience from "@/pages/VaultExperience";
import { fetchVaultSetup, saveVaultSetup, uploadVaultMedia, type PreOrder } from "@/lib/api";
import { classifyMedia, parseSpotifyEmbedUrl } from "@/lib/media";
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
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [saved, setSaved] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("order")?.trim() || "";
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
          setPageError(result.message || "Link tidak valid atau pesanan tidak ditemukan.");
          return;
        }
        setOrder(result.order);
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

  // Audio Recording Handlers
  const startRecording = async () => {
    setUploadError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([audioBlob], `voicenote-${Date.now()}.webm`, { type: "audio/webm" });
        void uploadFile(file, "audio");
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } catch {
      setUploadError("Tidak dapat mengakses mikrofon browser. Pastikan izin mikrofon telah aktif.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const uploadFile = async (file: File, type: "photo" | "audio") => {
    const isPhoto = type === "photo";
    const setUploading = isPhoto ? setUploadingPhoto : setUploadingAudio;
    const setPreview = isPhoto ? setPhotoPreview : setAudioPreview;
    const setUrl = isPhoto ? setPhotoUrl : setAudioUrl;
    const maxSize = isPhoto ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
    const allowedTypes = isPhoto
      ? ["image/jpeg", "image/png", "image/webp"]
      : ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/ogg", "audio/wav", "audio/webm"];

    setUploadError("");
    if (!allowedTypes.includes(file.type)) {
      setUploadError(isPhoto ? "Gunakan foto JPG, PNG, atau WebP." : "Format audio belum didukung.");
      return;
    }
    if (file.size > maxSize) {
      setUploadError(`Ukuran file maksimal ${isPhoto ? "5 MB" : "10 MB"}.`);
      return;
    }
    if (!orderId) return;

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setUploading(true);
    try {
      const url = await uploadVaultMedia(orderId, type, file);
      setUrl(url);
      setPreview(url);
      if (!isPhoto) {
        const audio = new Audio(url);
        audio.addEventListener("loadedmetadata", () => {
          if (Number.isFinite(audio.duration)) setAudioDuration(Math.round(audio.duration));
        }, { once: true });
      }
    } catch (error) {
      setPreview(isPhoto ? photoUrl : audioUrl);
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
    const file = event.dataTransfer.files[0];
    if (file) void uploadFile(file, "photo");
  };

  const handleAudioChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void uploadFile(file, "audio");
    event.target.value = "";
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!orderId || saving) return;
    if (audioSource === "spotify" && spotifyUrl.trim() && !parseSpotifyEmbedUrl(spotifyUrl)) {
      setUploadError("Periksa kembali link Spotify. Gunakan tautan track, album, atau playlist yang valid.");
      return;
    }
    if (customPin && !/^\d{4,6}$/.test(customPin)) {
      setUploadError("PIN rahasia harus terdiri dari 4 sampai 6 digit angka.");
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
      });
      if (!result.ok) throw new Error(result.message);
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
          <section className="vault-setup-card text-center" aria-live="polite">
            <p className="vault-setup-hint">Membuka ruang konfigurasi kenangan atelier...</p>
          </section>
        ) : pageError || !order ? (
          <section className="vault-setup-card text-center" role="alert">
            <div className="vault-setup-empty-icon" aria-hidden="true">🌿</div>
            <h2 className="vault-setup-card-title">Link Tidak Valid atau Pesanan Dibatalkan</h2>
            <p className="vault-setup-hint">
              Periksa kembali tautan yang dikirimkan oleh atelier A Chapter atau hubungi kurator WhatsApp kami.
            </p>
          </section>
        ) : saved ? (
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
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDropPhoto}
                  className="vault-drop-zone"
                >
                  <span className="drop-icon">📷</span>
                  <strong className="drop-title">
                    {uploadingPhoto ? "Sedang mengunggah foto..." : "Sentuh untuk memilih foto atau seret ke sini"}
                  </strong>
                  <span className="drop-hint">Format JPG, PNG, atau WebP · Maksimal 5 MB</span>
                  <input
                    id="vault-photo-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoChange}
                    disabled={uploadingPhoto}
                    style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
                  />
                </label>

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
                    <span className="drop-hint">Maksimal durasi bebas · Ukuran maksimal 10 MB</span>
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
                    {spotifyEmbedPreviewUrl && (
                      <iframe
                        title="Spotify Preview"
                        src={spotifyEmbedPreviewUrl}
                        width="100%"
                        height="152"
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        style={{ marginTop: "1rem", borderRadius: "8px", border: "none" }}
                      />
                    )}
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
                  Atur 4–6 digit PIN (opsional): Hanya orang yang tahu kode ini yang dapat membuka brankas memori.
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
                  disabled={saving || uploadingPhoto || uploadingAudio}
                  className="hero-cta hero-cta-primary vault-setup-save-btn"
                >
                  {saving ? "Mengunci Kenangan..." : "KUNCI & SIMPAN BRANKAS MEMORI →"}
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
                  audio_url: audioPreview || audioUrl,
                  audio_durasi: audioDuration,
                  video_url: videoUrl,
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
