export type MediaType = "spotify" | "youtube" | "direct_audio" | "direct_video" | "unknown";

export interface ClassifiedMedia {
  type: MediaType;
  embedUrl: string | null;
  isAudio: boolean;
  isVideo: boolean;
}

export interface ResolvedVaultMedia extends ClassifiedMedia {
  url: string;
}

const YOUTUBE_ID_PATTERN = /^[\w-]{11}$/;
const SPOTIFY_ID_PATTERN = /^[A-Za-z0-9]{1,64}$/;

function getSpotifyParts(rawUrl: string): { type: string; id: string } | null {
  const value = rawUrl.trim();
  const uriMatch = /^spotify:(track|album|playlist):([A-Za-z0-9]{1,64})$/i.exec(value);
  if (uriMatch) return { type: uriMatch[1].toLowerCase(), id: uriMatch[2] };

  try {
    const parsed = new URL(value);
    if (!parsed.hostname.toLowerCase().includes("spotify.com")) return null;
    const segments = parsed.pathname.split("/").filter(Boolean);
    const typeIndex = segments.findIndex(s => ["track", "album", "playlist"].includes(s.toLowerCase()));
    if (typeIndex === -1) return null;
    const type = segments[typeIndex].toLowerCase();
    const id = segments[typeIndex + 1]?.split("?")[0] || "";
    if (!SPOTIFY_ID_PATTERN.test(id)) return null;
    return { type, id };
  } catch {
    return null;
  }
}

export function parseSpotifyEmbedUrl(url: string): string | null {
  const parts = getSpotifyParts(url);
  if (!parts) return null;
  return `https://open.spotify.com/embed/${parts.type}/${parts.id}?utm_source=generator&theme=0`;
}

function parseYouTubeId(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl.trim());
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    let id = "";

    if (hostname === "youtu.be") {
      id = parsed.pathname.split("/").filter(Boolean)[0] || "";
    } else if (hostname === "youtube.com" || hostname.endsWith(".youtube.com") ||
      hostname === "youtube-nocookie.com" || hostname.endsWith(".youtube-nocookie.com")) {
      const segments = parsed.pathname.split("/").filter(Boolean);
      if (segments[0]?.toLowerCase() === "watch") {
        id = parsed.searchParams.get("v") || "";
      } else if (["embed", "shorts", "v"].includes((segments[0] || "").toLowerCase())) {
        id = segments[1] || "";
      }
    }

    return YOUTUBE_ID_PATTERN.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function parseYouTubeEmbedUrl(url: string): string | null {
  const id = parseYouTubeId(url);
  return id
    ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`
    : null;
}

function unknownMedia(): ClassifiedMedia {
  return { type: "unknown", embedUrl: null, isAudio: false, isVideo: false };
}

export function classifyMedia(url: string): ClassifiedMedia {
  const value = url.trim();
  if (!value) return unknownMedia();

  const spotifyEmbedUrl = parseSpotifyEmbedUrl(value);
  if (spotifyEmbedUrl) {
    return { type: "spotify", embedUrl: spotifyEmbedUrl, isAudio: true, isVideo: false };
  }

  const youtubeEmbedUrl = parseYouTubeEmbedUrl(value);
  if (youtubeEmbedUrl) {
    return { type: "youtube", embedUrl: youtubeEmbedUrl, isAudio: false, isVideo: true };
  }

  let pathname = value;
  try {
    pathname = new URL(value).pathname;
  } catch {
    // Keep the original value for extension and storage-path checks below.
  }
  const normalizedPath = `${pathname} ${value}`.toLowerCase();
  if (normalizedPath.includes("vault-media") || /\/audio\./i.test(normalizedPath)) {
    return { type: "direct_audio", embedUrl: null, isAudio: true, isVideo: false };
  }

  const extension = /\.([a-z0-9]+)(?:$|[?#\s])/i.exec(pathname)?.[1]?.toLowerCase();
  if (["mp3", "m4a", "wav", "ogg", "webm", "aac", "flac"].includes(extension || "")) {
    return { type: "direct_audio", embedUrl: null, isAudio: true, isVideo: false };
  }
  if (["mp4", "mov", "m4v", "ogv", "avi"].includes(extension || "")) {
    return { type: "direct_video", embedUrl: null, isAudio: false, isVideo: true };
  }
  return unknownMedia();
}

function classifyForInput(url: string, inputType: "audio" | "video"): ClassifiedMedia {
  const media = classifyMedia(url);
  if (!/\.webm(?:$|[?#])/i.test(url)) return media;
  return inputType === "audio"
    ? { type: "direct_audio", embedUrl: null, isAudio: true, isVideo: false }
    : { type: "direct_video", embedUrl: null, isAudio: false, isVideo: true };
}

function resolved(url: string, media: ClassifiedMedia): ResolvedVaultMedia {
  return { ...media, url };
}

export function resolveVaultMedia(rawAudioUrl?: string, rawVideoUrl?: string): {
  audioMedia: ResolvedVaultMedia;
  videoMedia: ResolvedVaultMedia;
} {
  let audioUrl = rawAudioUrl?.trim() || "";
  let videoUrl = rawVideoUrl?.trim() || "";
  let audioMedia = classifyForInput(audioUrl, "audio");
  let videoMedia = classifyForInput(videoUrl, "video");

  if (videoMedia.type === "spotify" && audioMedia.type === "unknown") {
    audioUrl = videoUrl;
    audioMedia = videoMedia;
    videoUrl = "";
    videoMedia = unknownMedia();
  }
  if (audioMedia.type === "youtube" && videoMedia.type === "unknown") {
    videoUrl = audioUrl;
    videoMedia = audioMedia;
    audioUrl = "";
    audioMedia = unknownMedia();
  }

  return {
    audioMedia: resolved(audioUrl, audioMedia),
    videoMedia: resolved(videoUrl, videoMedia),
  };
}
