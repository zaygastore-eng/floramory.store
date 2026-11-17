import type { CSSProperties } from "react";

/**
 * Satu sumber kebenaran untuk desain Memory Vault.
 * Dipakai oleh landing page (simulator), konsol pengirim (VaultSetup),
 * dan pengalaman penerima (VaultExperience) agar tampilan yang
 * dijanjikan di landing benar-benar bisa dibuat pelanggan.
 */

export type PhotoboothThemeId =
  | "cream"
  | "wine"
  | "periwinkle"
  | "crimson"
  | "blossom"
  | "midnight"
  | "sage";

export interface PhotoboothTheme {
  id: PhotoboothThemeId;
  name: string;
  bg: string;
  border: string;
  text: string;
  dot: string;
}

export const PHOTOBOOTH_THEMES: readonly PhotoboothTheme[] = [
  // ── Palette Utama ──
  { id: "cream", name: "Atelier Cream", bg: "#FAF7F2", border: "#E5DDD0", text: "#531B21", dot: "#D8C7B0" },
  { id: "wine", name: "Wine Romance", bg: "#531B21", border: "#6D252D", text: "#FBF3E8", dot: "#8C3843" },
  { id: "periwinkle", name: "Periwinkle Blue", bg: "#B4C6E7", border: "#9EB2D8", text: "#351419", dot: "#8EA8DA" },

  // ── Romance & Floral ──
  { id: "crimson", name: "Crimson Velvet", bg: "#7A222D", border: "#912E3B", text: "#FAF5EE", dot: "#A93A49" },
  { id: "blossom", name: "Blossom Pink", bg: "#F5D8DB", border: "#E8BAC0", text: "#531B21", dot: "#DB9FA8" },

  // ── Umum & Botanical ──
  { id: "midnight", name: "Midnight Noir", bg: "#1D1A1B", border: "#353031", text: "#F3ECE1", dot: "#524A4B" },
  { id: "sage", name: "Sage Olive", bg: "#DCE4D8", border: "#C6D1C1", text: "#2E3A2C", dot: "#B0C0AA" },
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
  font: "cormorant",
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
      sm: "clamp(0.85rem, 3.4vw, 0.98rem)",
      md: "clamp(0.98rem, 4vw, 1.14rem)",
      lg: "clamp(1.1rem, 4.6vw, 1.32rem)",
      xl: "clamp(1.24rem, 5.2vw, 1.54rem)",
    }[size];
  }
  return {
    sm: "clamp(0.85rem, 1.1vw, 0.98rem)",
    md: "clamp(1rem, 1.3vw, 1.14rem)", // 16px - 18.2px
    lg: "clamp(1.15rem, 1.8vw, 1.42rem)",
    xl: "clamp(1.3rem, 2.2vw, 1.72rem)",
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
    lineHeight: style.font === "parisienne" ? 1.5 : 1.8,
  };
}

/* ── Celebration mode ──
 * Vault baru menyimpan `vault_moment`; vault lama yang kolomnya null
 * tetap dirender sebagai arsip memoar (mode legacy). Momen, skin, dan
 * hook tidak pernah mengubah isi brankas — hanya cara ia dibuka.
 */

export type VaultMomentId = "birthday" | "anniversary" | "graduation" | "custom";

export type VaultHookId =
  | "cake"
  | "rose"
  | "graduation"
  | "gift-box"
  | "bouquet"
  | "envelope"
  | "celebration"
  | "confetti";

export interface VaultHookOption {
  id: VaultHookId;
  name: string;
  note: string;
}

export const VAULT_HOOKS: readonly VaultHookOption[] = [
  { id: "cake", name: "Birthday Cake", note: "Kue dan lilin yang menyala" },
  { id: "rose", name: "Single Rose", note: "Satu mawar untuk satu rasa" },
  { id: "graduation", name: "Graduation Cap", note: "Toga untuk babak yang selesai" },
  { id: "gift-box", name: "Gift Box", note: "Kotak kado yang terbuka perlahan" },
  { id: "bouquet", name: "Flower Bouquet", note: "Buket untuk merayakan" },
  { id: "envelope", name: "Love Letter", note: "Amplop dengan surat di dalamnya" },
  { id: "celebration", name: "Celebration", note: "Dua gelas untuk bersulang" },
  { id: "confetti", name: "Confetti", note: "Hujan kertas warna" },
] as const;

export const DEFAULT_VAULT_HOOK: VaultHookId = "gift-box";

export interface VaultMomentOption {
  id: VaultMomentId;
  name: string;
  short: string;
  note: string;
  defaultHook: VaultHookId;
  eyebrow: string;
  /** `{name}` diganti dengan nama penerima. */
  title: string;
}

export const VAULT_MOMENTS: readonly VaultMomentOption[] = [
  {
    id: "birthday",
    name: "Ulang Tahun",
    short: "Birthday",
    note: "Lilin, kue, dan satu hari yang sepenuhnya miliknya.",
    defaultHook: "cake",
    eyebrow: "SEBUAH HARI ISTIMEWA",
    title: "Selamat ulang tahun, {name}",
  },
  {
    id: "anniversary",
    name: "Anniversary",
    short: "Anniversary",
    note: "Untuk setiap bab yang sudah dan akan kalian lewati.",
    defaultHook: "bouquet",
    eyebrow: "SEBUAH PERJALANAN",
    title: "Untuk setiap bab yang kita lewati",
  },
  {
    id: "graduation",
    name: "Wisuda",
    short: "Graduation",
    note: "Perayaan untuk kerja keras yang akhirnya selesai.",
    defaultHook: "graduation",
    eyebrow: "SEBUAH PENCAPAIAN",
    title: "Selamat atas wisudamu, {name}",
  },
  {
    id: "custom",
    name: "Momen Lain",
    short: "Custom",
    note: "Tulis sendiri momennya — perpisahan, reuni, atau kejutan kecil.",
    defaultHook: "gift-box",
    eyebrow: "SEBUAH MOMEN SPESIAL",
    title: "Momen untuk {name}",
  },
] as const;

export const DEFAULT_VAULT_MOMENT: VaultMomentId = "birthday";

export type VaultSkinId = "noir" | "crayon" | "romance";

export interface VaultSkinOption {
  id: VaultSkinId;
  name: string;
  tagline: string;
}

export const VAULT_SKINS: readonly VaultSkinOption[] = [
  { id: "noir", name: "Noir Atelier", tagline: "Hitam anggur, emas redup, dan cahaya lilin." },
  { id: "crayon", name: "Crayon Party", tagline: "Krem hangat, garis tebal, dan energi tangan." },
  { id: "romance", name: "Romance Blush", tagline: "Merah muda pudar, renda, dan huruf yang lembut." },
] as const;

export const DEFAULT_VAULT_SKIN: VaultSkinId = "noir";

const MOMENT_IDS = new Set<string>(VAULT_MOMENTS.map((moment) => moment.id));
const SKIN_IDS = new Set<string>(VAULT_SKINS.map((skin) => skin.id));
const HOOK_IDS = new Set<string>(VAULT_HOOKS.map((hook) => hook.id));

/** `null` berarti vault lama tanpa mode perayaan (arsip memoar). */
export function normalizeVaultMoment(value: unknown): VaultMomentId | null {
  const raw = String(value || "").trim().toLowerCase();
  return MOMENT_IDS.has(raw) ? (raw as VaultMomentId) : null;
}

export function getVaultMoment(value: unknown): VaultMomentOption | null {
  const id = normalizeVaultMoment(value);
  return id ? VAULT_MOMENTS.find((moment) => moment.id === id) || null : null;
}

export function normalizeVaultSkin(value: unknown): VaultSkinId {
  const raw = String(value || "").trim().toLowerCase();
  return SKIN_IDS.has(raw) ? (raw as VaultSkinId) : DEFAULT_VAULT_SKIN;
}

export function getVaultSkin(value: unknown): VaultSkinOption {
  const id = normalizeVaultSkin(value);
  return VAULT_SKINS.find((skin) => skin.id === id) || VAULT_SKINS[0];
}

export function normalizeVaultHook(value: unknown): VaultHookId {
  const raw = String(value || "").trim().toLowerCase();
  return HOOK_IDS.has(raw) ? (raw as VaultHookId) : DEFAULT_VAULT_HOOK;
}

export function getVaultHook(value: unknown): VaultHookOption {
  const id = normalizeVaultHook(value);
  return VAULT_HOOKS.find((hook) => hook.id === id) || VAULT_HOOKS[0];
}

export function vaultMomentLabel(value: unknown): string {
  return String(value || "").trim().slice(0, 40);
}

/** Judul hub perayaan, sudah disesuaikan dengan penerima/label custom. */
export function vaultMomentTitle(
  moment: VaultMomentOption,
  recipient: unknown,
  customLabel: unknown
): string {
  const name = String(recipient || "").trim() || "kamu";
  if (moment.id === "custom") {
    return vaultMomentLabel(customLabel) || "Sebuah momen untukmu";
  }
  return moment.title.replace("{name}", name);
}

export interface VaultCelebrationConfig {
  isCelebration: boolean;
  moment: VaultMomentOption | null;
  skin: VaultSkinOption;
  hook: VaultHookOption;
  label: string;
}

/** Satu tempat untuk memutuskan celebration vs. archive legacy. */
export function resolveVaultCelebration(product: {
  vault_moment?: string | null;
  vault_moment_label?: string;
  vault_skin?: string;
  vault_hook_id?: string;
} | null | undefined): VaultCelebrationConfig {
  const moment = getVaultMoment(product?.vault_moment);
  return {
    isCelebration: Boolean(moment),
    moment,
    skin: getVaultSkin(product?.vault_skin),
    hook: getVaultHook(product?.vault_hook_id),
    label: vaultMomentLabel(product?.vault_moment_label),
  };
}

/* ── DP 50% gate ── */

export const DP_ORDER_STATUS_LABEL: Record<string, string> = {
  waiting_dp: "Menunggu pembayaran DP manual",
  new: "Menunggu konfirmasi atelier",
  dp_verified: "DP manual terverifikasi",
  in_production: "Sedang diproduksi atelier",
  in_progress: "Sedang diproses atelier",
  completed: "Selesai",
  paid: "Lunas",
  cancelled: "Dibatalkan",
};

export function dpStatusLabel(status: unknown): string {
  const normalized = String(status || "").trim().toLowerCase();
  return DP_ORDER_STATUS_LABEL[normalized] || "Menunggu konfirmasi atelier";
}
