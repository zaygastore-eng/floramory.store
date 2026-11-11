import { useCallback, useEffect, useRef, useState } from "react";

export const AUDIO_PLAYBACK_RATES = [1, 1.25, 1.5, 2] as const;
export type AudioPlaybackRate = (typeof AUDIO_PLAYBACK_RATES)[number];

/**
 * Pemutar audio ringan untuk simulator folio (Home & Smart QR Vault).
 * Menyediakan kontrol ala Spotify: play/pause, scrub waktu, lompat ±10 detik,
 * dan kecepatan putar 1x–2x. Satu instance audio per halaman; mengganti src
 * akan menghentikan audio lama agar tidak ada dua lagu berbunyi bersamaan.
 */
export function useAudioPlayback(fallbackDuration = 131) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const srcRef = useRef("");
  const seekingRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(fallbackDuration);
  const [rate, setRate] = useState<AudioPlaybackRate>(1);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      srcRef.current = "";
    };
  }, []);

  const ensureAudio = useCallback(
    (src: string) => {
      if (audioRef.current && srcRef.current === src) return audioRef.current;

      audioRef.current?.pause();
      const audio = new Audio(src);
      audioRef.current = audio;
      srcRef.current = src;

      audio.addEventListener("loadedmetadata", () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          setDuration(audio.duration);
        }
      });
      audio.addEventListener("timeupdate", () => {
        if (!seekingRef.current) setCurrentTime(audio.currentTime);
      });
      audio.addEventListener("ended", () => {
        setIsPlaying(false);
        setCurrentTime(0);
        audio.currentTime = 0;
      });

      audio.playbackRate = rate;
      return audio;
    },
    [rate]
  );

  const toggle = useCallback(
    (src: string) => {
      const audio = ensureAudio(src);
      if (audio.paused) {
        audio
          .play()
          .then(() => setIsPlaying(true))
          .catch((error) => {
            console.warn("[A Chapter Audio] Playback prevented:", error);
            setIsPlaying(false);
          });
      } else {
        audio.pause();
        setIsPlaying(false);
      }
    },
    [ensureAudio]
  );

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const seekTo = useCallback(
    (seconds: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const max = Number.isFinite(audio.duration) ? audio.duration : duration;
      const next = Math.min(Math.max(0, seconds), max || 0);
      audio.currentTime = next;
      setCurrentTime(next);
    },
    [duration]
  );

  const skip = useCallback(
    (delta: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      seekTo(audio.currentTime + delta);
    },
    [seekTo]
  );

  const cycleRate = useCallback(() => {
    setRate((prev) => {
      const index = AUDIO_PLAYBACK_RATES.indexOf(prev);
      return AUDIO_PLAYBACK_RATES[(index + 1) % AUDIO_PLAYBACK_RATES.length];
    });
  }, []);

  const seekStart = useCallback(() => {
    seekingRef.current = true;
  }, []);

  const seekEnd = useCallback(() => {
    seekingRef.current = false;
  }, []);

  return {
    isPlaying,
    currentTime,
    duration,
    rate,
    toggle,
    pause,
    seekTo,
    skip,
    cycleRate,
    seekStart,
    seekEnd,
  };
}
