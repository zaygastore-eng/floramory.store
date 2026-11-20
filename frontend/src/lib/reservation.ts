/**
 * Shared reservation helpers.
 *
 * The pre-order form lives on its own page (/pre-order), while product
 * detail pages add configured items to the same local draft. Keeping the
 * storage contract in one module prevents the two entry points from drifting.
 */

export const NUANSA_WARNA_OPTIONS = [
  {
    id: "crimson-romance",
    label: "Crimson Romance",
    detail: "Nuansa Merah Crimson & Emas",
    swatch: "#7A222D",
  },
  {
    id: "bridgerton-blue",
    label: "Bridgerton Blue",
    detail: "Nuansa Biru Lembut & Mutiara",
    swatch: "#B4C6E7",
  },
  {
    id: "classic-ivory",
    label: "Classic Ivory",
    detail: "Nuansa Krem & Bunga Natural",
    swatch: "#FAF5EE",
  },
] as const;

export type NuansaId = (typeof NUANSA_WARNA_OPTIONS)[number]["id"];

export interface ReservationDraftItem {
  uid: string;
  productId: string;
  qty: number;
  nuansa: NuansaId;
  inisial: string;
}

const DRAFT_KEY = "fm_preorder_draft_v1";
const MAX_QTY = 20;

export const RESERVATION_MAX_QTY = MAX_QTY;

function createUid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function isNuansaId(value: unknown): value is NuansaId {
  return NUANSA_WARNA_OPTIONS.some(option => option.id === value);
}

export function clampQty(value: unknown): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(MAX_QTY, Math.max(1, parsed));
}

export function createReservationItem(
  productId = "",
  nuansa: NuansaId = NUANSA_WARNA_OPTIONS[0].id
): ReservationDraftItem {
  return {
    uid: createUid(),
    productId,
    qty: 1,
    nuansa,
    inisial: "",
  };
}

export function loadReservationDraft(): ReservationDraftItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map(entry => {
      const item = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
      return {
        uid: typeof item.uid === "string" && item.uid ? item.uid : createUid(),
        productId: String(item.productId || "").trim(),
        qty: clampQty(item.qty),
        nuansa: isNuansaId(item.nuansa) ? item.nuansa : NUANSA_WARNA_OPTIONS[0].id,
        inisial: String(item.inisial || "").slice(0, 10),
      };
    });
  } catch {
    return [];
  }
}

export function saveReservationDraft(items: ReservationDraftItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("fm-draft-updated"));
  } catch {
    // Storage can be unavailable in private mode. The in-memory page state
    // remains usable, so this is intentionally non-fatal.
  }
}

export function clearReservationDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
    // The old online-payment flow stored a pending QRIS session. It is no
    // longer used; clear it so stale banners cannot resurface.
    window.localStorage.removeItem("fm_pending_payment_v1");
    window.dispatchEvent(new CustomEvent("fm-draft-updated"));
  } catch {
    // Ignore storage failures.
  }
}

/**
 * Adds a configured product to the draft. Identical configurations are
 * merged (quantity incremented) to avoid accidental duplicate rows when a
 * visitor presses the CTA twice.
 */
export function addReservationItem(input: {
  productId: string;
  qty?: number;
  nuansa?: string;
  inisial?: string;
}): ReservationDraftItem[] {
  const items = loadReservationDraft();
  const productId = input.productId.trim();
  const nuansa = isNuansaId(input.nuansa) ? input.nuansa : NUANSA_WARNA_OPTIONS[0].id;
  const qty = clampQty(input.qty);
  const inisial = String(input.inisial || "").slice(0, 10);

  const emptyIndex = items.findIndex(item => !item.productId);
  if (emptyIndex >= 0) {
    items[emptyIndex] = {
      ...items[emptyIndex],
      productId,
      qty,
      nuansa,
      inisial,
    };
    saveReservationDraft(items);
    return items;
  }

  const duplicateIndex = items.findIndex(
    item =>
      item.productId === productId &&
      item.nuansa === nuansa &&
      item.inisial.trim().toLowerCase() === inisial.trim().toLowerCase()
  );

  if (duplicateIndex >= 0) {
    const existing = items[duplicateIndex];
    items[duplicateIndex] = {
      ...existing,
      qty: clampQty(existing.qty + qty),
    };
  } else {
    items.push({ uid: createUid(), productId, qty, nuansa, inisial });
  }

  saveReservationDraft(items);
  return items;
}

export function parseHargaAmount(raw: unknown): number {
  const digits = String(raw ?? "").replace(/[^\d]/g, "");
  const amount = Number(digits);
  return Number.isSafeInteger(amount) ? amount : 0;
}
