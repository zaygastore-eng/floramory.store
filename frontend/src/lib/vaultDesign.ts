import type { CSSProperties } from "react";

/**
 * Satu sumber kebenaran untuk desain Memory Vault.
 * Dipakai oleh landing page (simulator), konsol pengirim (VaultSetup),
 * dan pengalaman penerima (VaultExperience) agar tampilan yang
 * dijanjikan di landing benar-benar bisa dibuat pelanggan.
 */

export type PhotoboothThemeId = "cream" | "wine" | "periwinkle" | "midnight" | "blossom";

export interface PhotoboothTheme {
  id: PhotoboothThemeId;
  name: string;
  bg: string;
  border: string;
  text: string;
  dot: string;
}

export const PHOTOBOOTH_THEMES: readonly PhotoboothTheme[] = [
  { id: "cream", name: "Atelier Cream", bg: "#FAF7F2", border: "#E5DDD0", text: "#531B21", dot: "#D8C7B0" },
  { id: "wine", name: "Wine Romance", bg: "#531B21", border: "#6D252D", text: "#FBF3E8", dot: "#8C3843" },
  { id: "periwinkle", name: "Periwinkle Blue", bg: "#BCC8F5", border: "#A2B3ED", text: "#3B1418", dot: "#8CA2E5" },
  { id: "midnight", name: "Midnight Noir", bg: "#1D1A1B", border: "#353031", text: "#F3ECE1", dot: "#524A4B" },
  { id: "blossom", name: "Blossom Pink", bg: "#F5D8DB", border: "#E8BAC0", text: "#531B21", dot: "#DB9FA8" },
] as const;

export const DEFAULT_PHOTOBOOTH_THEME: PhotoboothThemeId = "cream";
export const MAX_VAULT_PHOTOS = 4;

const THEME_IDS = new Set<string>(PHOTOBOOTH_THEMES.map((theme) => theme.id));

export function normalizePhotoboothTheme(value: unknown): PhotoboothThemeId {
  const raw = String(value || "").trim().toLowerCase();
  return THEME_IDS.has(raw) ? (raw as PhotoboothThemeId) : DEFAULT_PHOTOBOOTH_THEME;
}

export function getPhotoboothTheme(value: unknown): PhotoboothTheme {
  const id = normalizePhotoboothTheme(value);
  return PHOTOBOOTH_THEMES.find((theme) => theme.id === id) || PHOTOBOOTH_THEMES[0];
}

/* ── Letter styling ── */

export type LetterFontId = "parisienne" | "cinzel" | "cormorant" | "sans";
export type LetterSizeId = "sm" | "md" | "lg" | "xl";
export type LetterAlignId = "left" | "center" | "right";

export interface VaultLetterStyle {
  font: LetterFontId;
  size: LetterSizeId;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: LetterAlignId;
  color: string;
}

export const LETTER_FONT_OPTIONS: ReadonlyArray<{
  id: LetterFontId;
  label: string;
  stack: string;
  sampleSize: string;
}> = [
  { id: "parisienne", label: "Parisienne", stack: "'Parisienne', cursive", sampleSize: "1.05rem" },
  { id: "cinzel", label: "Cinzel", stack: "'Cinzel', serif", sampleSize: "0.82rem" },
  { id: "cormorant", label: "Cormorant", stack: "'Cormorant Garamond', serif", sampleSize: "0.95rem" },
  { id: "sans", label: "Modern", stack: "'DM Sans', sans-serif", sampleSize: "0.82rem" },
] as const;

export const LETTER_SIZE_OPTIONS: ReadonlyArray<{ id: LetterSizeId; label: string }> = [
  { id: "sm", label: "SM" },
  { id: "md", label: "MD" },
  { id: "lg", label: "LG" },
  { id: "xl", label: "XL" },
] as const;

export const LETTER_INK_TONES: ReadonlyArray<{ color: string; name: string }> = [
  { color: "#531B21", name: "Atelier Wine" },
  { color: "#2A2523", name: "Charcoal" },
  { color: "#783642", name: "Rosewood" },
] as const;

export const DEFAULT_LETTER_STYLE: VaultLetterStyle = {
  font: "parisienne",
  size: "md",
  bold: false,
  italic: false,
  underline: false,
  align: "center",
  color: "#531B21",
};

const FONT_IDS = new Set<string>(LETTER_FONT_OPTIONS.map((font) => font.id));
const SIZE_IDS = new Set<string>(LETTER_SIZE_OPTIONS.map((size) => size.id));
const ALIGN_IDS = new Set<LetterAlignId>(["left", "center", "right"]);
const INK_COLORS = new Set<string>(LETTER_INK_TONES.map((ink) => ink.color));

export function normalizeLetterStyle(value: unknown): VaultLetterStyle {
  const raw = (value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {}) as Record<string, unknown>;

  const font = String(raw.font || "").toLowerCase();
  const size = String(raw.size || "").toLowerCase();
  const align = String(raw.align || "").toLowerCase();
  const color = String(raw.color || "").trim();

  return {
    font: FONT_IDS.has(font) ? (font as LetterFontId) : DEFAULT_LETTER_STYLE.font,
    size: SIZE_IDS.has(size) ? (size as LetterSizeId) : DEFAULT_LETTER_STYLE.size,
    bold: raw.bold === true,
    italic: raw.italic === true,
    underline: raw.underline === true,
    align: ALIGN_IDS.has(align as LetterAlignId) ? (align as LetterAlignId) : DEFAULT_LETTER_STYLE.align,
    color: INK_COLORS.has(color) ? color : DEFAULT_LETTER_STYLE.color,
  };
}

export function letterFontStack(font: LetterFontId): string {
  return LETTER_FONT_OPTIONS.find((option) => option.id === font)?.stack || LETTER_FONT_OPTIONS[0].stack;
}

/**
 * Ukuran teks surat. `board` dipakai di kanvas perkamen besar pada
 * konsol pengirim, `compact` untuk layar penerima di ponsel.
 */
export function letterFontSize(size: LetterSizeId, mode: "board" | "compact" = "board"): string {
  if (mode === "compact") {
    return {
      sm: "clamp(0.8rem, 3.4vw, 0.95rem)",
      md: "clamp(0.92rem, 4vw, 1.12rem)",
      lg: "clamp(1.05rem, 4.6vw, 1.3rem)",
      xl: "clamp(1.18rem, 5.2vw, 1.5rem)",
    }[size];
  }
  return {
    sm: "clamp(0.78rem, 1.1vw, 0.95rem)",
    md: "clamp(0.92rem, 1.4vw, 1.18rem)",
    lg: "clamp(1.05rem, 1.8vw, 1.4rem)",
    xl: "clamp(1.22rem, 2.2vw, 1.7rem)",
  }[size];
}

export function letterStyleToCss(
  style: VaultLetterStyle,
  mode: "board" | "compact" = "board"
): CSSProperties {
  return {
    fontFamily: letterFontStack(style.font),
    fontSize: letterFontSize(style.size, mode),
    fontWeight: style.bold ? 700 : 400,
    fontStyle: style.italic ? "italic" : "normal",
    textDecoration: style.underline ? "underline" : "none",
    textAlign: style.align,
    color: style.color,
    lineHeight: style.font === "parisienne" ? 1.5 : 1.65,
  };
}

/* ── DP 50% gate ── */

/** Status pesanan yang sudah lolos verifikasi DP 50% dan boleh mengisi vault. */
export const DP_VERIFIED_STATUSES = [
  "dp_verified",
  "in_production",
  "in_progress",
  "completed",
  "paid",
] as const;

export function isDpVerifiedStatus(status: unknown): boolean {
  const normalized = String(status || "").trim().toLowerCase();
  return (DP_VERIFIED_STATUSES as readonly string[]).includes(normalized);
}

export const DP_ORDER_STATUS_LABEL: Record<string, string> = {
  waiting_dp: "Menunggu verifikasi DP 50%",
  new: "Menunggu verifikasi DP 50%",
  dp_verified: "DP 50% terverifikasi",
  in_production: "Sedang diproduksi atelier",
  in_progress: "Sedang diproses atelier",
  completed: "Selesai",
  paid: "Lunas",
  cancelled: "Dibatalkan",
};

export function dpStatusLabel(status: unknown): string {
  const normalized = String(status || "").trim().toLowerCase();
  return DP_ORDER_STATUS_LABEL[normalized] || "Menunggu verifikasi DP 50%";
}
