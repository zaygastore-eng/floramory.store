import React, { useEffect, useRef, useState, useCallback } from "react";

export interface AudioPlayerProps {
  src: string;
  initialDuration?: number; // fallback duration in seconds
  title?: string;
  className?: string;
}

/**
 * Safely format seconds into mm:ss display.
 * Handles NaN, Infinity, negative values, and undefined gracefully.
 */
function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function AudioPlayer({
  src,
  initialDuration = 0,
  title = "Pesan Suara Kenangan",
  className = "",
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isSeekingRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number>(() =>
    Number.isFinite(initialDuration) && initialDuration > 0 ? initialDuration : 0
  );
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Sync initial duration if updated from props
  useEffect(() => {
    if (Number.isFinite(initialDuration) && initialDuration > 0) {
      setDuration(prev => (prev > 0 ? prev : initialDuration));
    }
  }, [initialDuration]);

  // Reset state when src changes
  useEffect(() => {
    setCurrentTime(0);
    setIsPlaying(false);
    setHasError(false);
    setIsLoading(false);
  }, [src]);

  // Native audio event bindings
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      if (audio.duration && Number.isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
      setIsLoading(false);
    };

    const onTimeUpdate = () => {
      if (!isSeekingRef.current) {
        setCurrentTime(audio.currentTime);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (audio) audio.currentTime = 0;
    };

    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);
    const onPlaying = () => {
      setIsLoading(false);
      setIsPlaying(true);
    };
    const onPause = () => setIsPlaying(false);

    const onError = () => {
      setIsLoading(false);
      setIsPlaying(false);
      setHasError(true);
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
    };
  }, [src]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !src || hasError) return;

    if (isPlaying) {
      audio.pause();
    } else {
      setIsLoading(true);
      audio.play().catch(err => {
        console.warn("[Floramory Audio] Playback prevented or interrupted:", err);
        setIsPlaying(false);
        setIsLoading(false);
      });
    }
  }, [isPlaying, src, hasError]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = Number(e.target.value);
    setCurrentTime(targetTime);
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
    }
  };

  const handleSeekStart = () => {
    isSeekingRef.current = true;
  };

  const handleSeekEnd = () => {
    isSeekingRef.current = false;
  };

  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <div className={`floramory-audio-card ${className}`}>
      {/* Hidden audio element adhering to mobile policies */}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        playsInline
      />

      <div className="audio-card-inner">
        {/* Circular Play / Pause / Loading Button (min 44x44px touch target) */}
        <button
          type="button"
          className={`audio-play-btn${isPlaying ? " is-playing" : ""}`}
          onClick={togglePlay}
          disabled={hasError || !src}
          aria-label={isPlaying ? "Jeda pesan suara" : "Putar pesan suara"}
        >
          {isLoading ? (
            <span className="audio-spinner" aria-hidden="true" />
          ) : isPlaying ? (
            <svg
              className="audio-icon"
              viewBox="0 0 24 24"
              fill="currentColor"
              width="22"
              height="22"
              aria-hidden="true"
            >
              <rect x="6" y="5" width="4" height="14" rx="1.5" />
              <rect x="14" y="5" width="4" height="14" rx="1.5" />
            </svg>
          ) : (
            <svg
              className="audio-icon audio-icon-play"
              viewBox="0 0 24 24"
              fill="currentColor"
              width="22"
              height="22"
              aria-hidden="true"
            >
              <path d="M8 5.5v13a1 1 0 0 0 1.55.83l10-6.5a1 1 0 0 0 0-1.66l-10-6.5A1 1 0 0 0 8 5.5z" />
            </svg>
          )}
        </button>

        {/* Timeline & Metadata */}
        <div className="audio-content-col">
          <div className="audio-header-row">
            <span className="audio-title">{title}</span>
            <span className="audio-time-label">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Interactive Scrubbing Slider with >=44px touch target wrap */}
          <div className="audio-scrub-container">
            <input
              type="range"
              className="audio-scrub-slider"
              min={0}
              max={duration > 0 ? duration : 100}
              step={0.1}
              value={currentTime}
              onChange={handleSliderChange}
              onMouseDown={handleSeekStart}
              onMouseUp={handleSeekEnd}
              onTouchStart={handleSeekStart}
              onTouchEnd={handleSeekEnd}
              disabled={hasError || !src || duration === 0}
              style={{
                background: `linear-gradient(to right, var(--sage, #697099) ${progressPercent}%, rgba(105, 112, 153, 0.2) ${progressPercent}%)`,
              }}
              aria-label="Progres pemutaran audio"
            />
          </div>
        </div>
      </div>

      {hasError && (
        <p className="audio-error-hint">
          Audio tidak dapat dimuat. Pastikan koneksi internet Anda stabil atau buka kembali halaman.
        </p>
      )}
    </div>
  );
}
