import { useEffect, useState, type DragEvent, type ChangeEvent, type FormEvent } from "react";
import BrandLogo from "@/components/BrandLogo";
import { fetchVaultSetup, saveVaultSetup, uploadVaultMedia, type PreOrder } from "@/lib/api";
import { classifyMedia, parseSpotifyEmbedUrl } from "@/lib/media";
import { pageUrl } from "@/lib/site";

const cardStyle = {
  padding: "clamp(1.25rem, 4vw, 2rem)",
  border: "1px solid rgba(105, 112, 153, 0.16)",
  borderRadius: "22px",
  background: "rgba(255, 255, 255, 0.9)",
  boxShadow: "0 16px 42px rgba(37, 43, 82, 0.07)",
};

const labelStyle = {
  display: "block",
  marginBottom: "0.55rem",
  color: "#4f557d",
  fontWeight: 600,
};

const hintStyle = {
  display: "block",
  marginTop: "0.55rem",
  color: "#697099",
  fontSize: "0.85rem",
  lineHeight: 1.6,
};

export default function VaultSetup() {
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<PreOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioPreview, setAudioPreview] = useState("");
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioMode, setAudioMode] = useState<"voice" | "spotify">("voice");
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [saved, setSaved] = useState(false);

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
          setAudioMode("spotify");
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

  const uploadFile = async (file: File, type: "photo" | "audio") => {
    const isPhoto = type === "photo";
    if (!isPhoto) setAudioMode("voice");
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
    if (audioMode === "spotify" && spotifyUrl.trim() && !parseSpotifyEmbedUrl(spotifyUrl)) {
      setUploadError("Periksa kembali link Spotify. Gunakan tautan track, album, atau playlist yang valid.");
      return;
    }
    setSaving(true);
    setUploadError("");
    try {
      const result = await saveVaultSetup(orderId, {
        personal_message: personalMessage,
        foto_vault: photoUrl,
        audio_url: audioMode === "spotify" ? spotifyUrl.trim() : audioUrl,
        audio_durasi: audioMode === "spotify" ? 0 : audioDuration,
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

  return (
    <main style={{
      minHeight: "100vh",
      padding: "1.25rem 1rem 3rem",
      background: "radial-gradient(ellipse at top, #fff 0%, #fafbff 45%, #f1f2f8 100%)",
      color: "#111",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ width: "min(100%, 760px)", margin: "0 auto" }}>
        <header style={{ padding: "1rem 0 1.5rem", textAlign: "center" }}>
          <a href={pageUrl("/")} aria-label="Floramory" style={{ display: "inline-flex", justifyContent: "center" }}>
            <BrandLogo />
          </a>
          <p style={{ margin: "0.4rem 0 0", color: "#697099", fontSize: "0.9rem", letterSpacing: "0.08em" }}>
            PRIVATE MEMORY VAULT SETUP
          </p>
        </header>

        {loading ? (
          <section style={{ ...cardStyle, textAlign: "center", color: "#697099" }} aria-live="polite">
            Membuka ruang kenangan pribadi...
          </section>
        ) : pageError || !order ? (
          <section style={{ ...cardStyle, textAlign: "center" }} role="alert">
            <div style={{ fontSize: "2.5rem" }} aria-hidden="true">🌿</div>
            <h1 style={{ margin: "0.75rem 0", color: "#4f557d", fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
              Link tidak valid atau pesanan tidak ditemukan
            </h1>
            <p style={{ margin: 0, color: "#697099", lineHeight: 1.7 }}>
              Periksa kembali tautan dari Floramory atau hubungi tim atelier untuk mendapatkan bantuan.
            </p>
          </section>
        ) : saved ? (
          <section style={{ ...cardStyle, padding: "clamp(2rem, 8vw, 4rem)", textAlign: "center" }} role="status">
            <div style={{ fontSize: "3rem" }} aria-hidden="true">✨</div>
            <h1 style={{ margin: "1rem 0", color: "#4f557d", fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(2rem, 8vw, 2.8rem)" }}>
              Kenangan tersimpan
            </h1>
            <p style={{ margin: "0 auto", maxWidth: "38rem", color: "#697099", lineHeight: 1.8 }}>
              Kenangan Anda berhasil dikunci dengan aman! Tim Floramory akan menyematkan PIN rahasia pada kartu fisik di dalam boks kado bunga yang akan diterima oleh orang tersayang Anda.
            </p>
          </section>
        ) : (
          <>
            <section style={{
              ...cardStyle,
              marginBottom: "1rem",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.5rem",
              background: "linear-gradient(125deg, #fff, #f8f6ef)",
            }}>
              <div>
                <span style={{ color: "#697099", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Pesanan privat</span>
                <strong style={{ display: "block", color: "#4f557d", marginTop: "0.25rem" }}>#{orderLabel}</strong>
              </div>
              <div style={{ color: "#697099" }}>Untuk: <strong style={{ color: "#4f557d" }}>{order.recipient_name || "Penerima kado"}</strong></div>
            </section>

            <form onSubmit={handleSave} style={{ display: "grid", gap: "1rem" }}>
              <section style={cardStyle}>
                <span style={{ color: "#9b8a60", fontSize: "0.78rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>01 · Surat personal</span>
                <h1 style={{ margin: "0.4rem 0 1rem", color: "#4f557d", fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "2rem" }}>Kata-kata dari hati</h1>
                <label htmlFor="vault-message" style={labelStyle}>Pesan kenangan</label>
                <textarea
                  id="vault-message"
                  value={personalMessage}
                  onChange={event => setPersonalMessage(event.target.value)}
                  maxLength={2000}
                  rows={7}
                  placeholder="Tuliskan cerita, doa, atau pesan yang ingin selalu diingat..."
                  style={{ width: "100%", boxSizing: "border-box", padding: "1rem", borderRadius: "14px", border: "1px solid #dfe1ec", background: "#fff", color: "#292d49", font: "inherit", lineHeight: 1.7, resize: "vertical" }}
                />
                <span style={hintStyle}>{personalMessage.length}/2000 karakter</span>
                <p style={{ margin: "1rem 0 0", color: "#697099", fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "1.2rem" }}>
                  Dengan penuh cinta,<br /><strong style={{ color: "#4f557d" }}>Dari: {order.sender_name || order.customer_name || "Floramory"}</strong>
                </p>
              </section>

              <section style={cardStyle}>
                <span style={{ color: "#9b8a60", fontSize: "0.78rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>02 · Foto kenangan</span>
                <h2 style={{ margin: "0.4rem 0 1rem", color: "#4f557d", fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "1.8rem" }}>Polaroid Capsule Photo</h2>
                <label
                  htmlFor="vault-photo"
                  onDragOver={event => event.preventDefault()}
                  onDrop={handleDropPhoto}
                  style={{ display: "grid", placeItems: "center", minHeight: "145px", padding: "1.25rem", border: "1px dashed #b9bdd1", borderRadius: "16px", background: "#fafbff", textAlign: "center", cursor: "pointer", color: "#697099" }}
                >
                  <span><strong style={{ display: "block", color: "#4f557d" }}>{uploadingPhoto ? "Mengunggah foto..." : "Sentuh untuk memilih atau letakkan foto di sini"}</strong><small style={{ display: "block", marginTop: "0.4rem" }}>JPG, PNG, atau WebP · Maks. 5 MB</small></span>
                  <input id="vault-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} disabled={uploadingPhoto} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} />
                </label>
                {photoPreview && (
                  <figure style={{ width: "min(100%, 300px)", margin: "1.25rem auto 0", padding: "0.8rem 0.8rem 2.4rem", background: "#fff", boxShadow: "0 12px 30px rgba(37,43,82,.13)", transform: "rotate(-1deg)" }}>
                    <img src={photoPreview} alt="Pratinjau foto kenangan" style={{ display: "block", width: "100%", aspectRatio: "1", objectFit: "cover", background: "#f1f2f8" }} />
                    <figcaption style={{ paddingTop: "0.65rem", color: "#697099", textAlign: "center", fontFamily: "'Cormorant Garamond', Georgia, serif" }}>A moment kept close</figcaption>
                  </figure>
                )}
              </section>

              <section style={cardStyle}>
                <span style={{ color: "#9b8a60", fontSize: "0.78rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>03 · Audio / Lagu</span>
                <h2 style={{ margin: "0.4rem 0 1rem", color: "#4f557d", fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "1.8rem" }}>Suara atau lagu kenangan</h2>
                <div role="group" aria-label="Pilih jenis audio" style={{ display: "flex", flexWrap: "wrap", gap: "0.55rem", marginBottom: "1rem" }}>
                  <button
                    type="button"
                    aria-pressed={audioMode === "voice"}
                    onClick={() => setAudioMode("voice")}
                    style={{ border: "1px solid #c9cddd", borderRadius: "999px", padding: "0.65rem 0.9rem", background: audioMode === "voice" ? "#4f557d" : "#fff", color: audioMode === "voice" ? "#fff" : "#4f557d", font: "inherit", fontWeight: 600, cursor: "pointer" }}
                  >
                    Unggah Rekaman Suara (VN)
                  </button>
                  <button
                    type="button"
                    aria-pressed={audioMode === "spotify"}
                    onClick={() => { setAudioMode("spotify"); setAudioDuration(0); }}
                    style={{ border: "1px solid #c9cddd", borderRadius: "999px", padding: "0.65rem 0.9rem", background: audioMode === "spotify" ? "#4f557d" : "#fff", color: audioMode === "spotify" ? "#fff" : "#4f557d", font: "inherit", fontWeight: 600, cursor: "pointer" }}
                  >
                    Tempel Link Lagu Spotify
                  </button>
                </div>
                {audioMode === "spotify" ? (
                  <>
                    <label htmlFor="vault-spotify" style={labelStyle}>Link Spotify</label>
                    <input
                      id="vault-spotify"
                      type="url"
                      value={spotifyUrl}
                      onChange={event => { setSpotifyUrl(event.target.value); setAudioDuration(0); }}
                      placeholder="https://open.spotify.com/track/..."
                      style={{ width: "100%", boxSizing: "border-box", padding: "0.9rem 1rem", borderRadius: "12px", border: "1px solid #dfe1ec", font: "inherit", color: "#292d49" }}
                    />
                    <span style={hintStyle}>Tempel link lagu, album, atau playlist Spotify.</span>
                    {spotifyEmbedPreviewUrl && (
                      <iframe
                        title="Pratinjau Lagu Kenangan Spotify"
                        src={spotifyEmbedPreviewUrl}
                        width="100%"
                        height="152"
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        loading="lazy"
                        style={{ display: "block", marginTop: "1rem", borderRadius: "14px", border: "none" }}
                      />
                    )}
                    {spotifyUrl.trim() && !spotifyEmbedPreviewUrl && (
                      <span role="status" style={{ ...hintStyle, color: "#9d3e32" }}>Link Spotify belum valid. Tempel tautan track, album, atau playlist Spotify.</span>
                    )}
                  </>
                ) : (
                  <>
                    <label htmlFor="vault-audio" style={labelStyle}>{uploadingAudio ? "Mengunggah audio..." : "Pilih rekaman suara"}</label>
                    <input id="vault-audio" type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,audio/wav,audio/webm" onChange={handleAudioChange} disabled={uploadingAudio} />
                    <span style={hintStyle}>MP3, M4A, WAV, OGG, atau WebM · Maks. 10 MB</span>
                    {audioPreview && (
                      <audio
                        controls
                        preload="metadata"
                        src={audioPreview}
                        onLoadedMetadata={event => {
                          const duration = event.currentTarget.duration;
                          if (Number.isFinite(duration)) setAudioDuration(Math.round(duration));
                        }}
                        style={{ display: "block", width: "100%", marginTop: "1rem" }}
                      />
                    )}
                  </>
                )}
              </section>

              <section style={cardStyle}>
                <span style={{ color: "#9b8a60", fontSize: "0.78rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>04 · Video opsional</span>
                <h2 style={{ margin: "0.4rem 0 1rem", color: "#4f557d", fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "1.8rem" }}>Moving memories</h2>
                <label htmlFor="vault-video" style={labelStyle}>Link video YouTube atau video langsung</label>
                <input
                  id="vault-video"
                  type="url"
                  value={videoUrl}
                  onChange={event => setVideoUrl(event.target.value)}
                  placeholder="https://youtu.be/... atau https://..."
                  style={{ width: "100%", boxSizing: "border-box", padding: "0.9rem 1rem", borderRadius: "12px", border: "1px solid #dfe1ec", font: "inherit", color: "#292d49" }}
                />
                <span style={hintStyle}>Gunakan link YouTube (termasuk unlisted) atau URL video langsung.</span>
              </section>

              {uploadError && (
                <p role="alert" style={{ margin: 0, padding: "0.9rem 1rem", borderRadius: "12px", background: "#fff0ed", color: "#9d3e32" }}>
                  {uploadError}
                </p>
              )}
              <button
                type="submit"
                disabled={saving || uploadingPhoto || uploadingAudio}
                style={{ width: "100%", minHeight: "3.5rem", border: 0, borderRadius: "14px", padding: "0.9rem 1.25rem", background: "#4f557d", color: "#fff", font: "inherit", fontWeight: 700, fontSize: "1rem", cursor: saving ? "wait" : "pointer", boxShadow: "0 12px 28px rgba(79,85,125,.22)" }}
              >
                {saving ? "Menyimpan kenangan..." : "Simpan ke Memory Vault ✦"}
              </button>
              <p style={{ margin: "-0.3rem 0 0", textAlign: "center", color: "#697099", fontSize: "0.82rem" }}>
                Kenangan ini hanya digunakan untuk kado Anda.
              </p>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
