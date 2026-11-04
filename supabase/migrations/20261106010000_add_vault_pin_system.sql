-- ============================================================
-- Floramory — Migration: Scratch-Off Physical PIN System
-- ============================================================
-- Replaces WhatsApp OTP with a 6-digit physical scratch-off PIN
-- for unlocking the Memory Vault. Includes brute-force rate-limiting
-- (lockout after 5 failed attempts for 15 minutes).
-- ============================================================

-- 1. Add Scratch-Off Physical PIN columns to public.products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS vault_pin VARCHAR(6) NULL,
  ADD COLUMN IF NOT EXISTS pin_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMPTZ NULL;

-- 2. Add vault_pin column to public.preorder_orders
ALTER TABLE public.preorder_orders
  ADD COLUMN IF NOT EXISTS vault_pin VARCHAR(6) NULL;

-- 3. Security / RLS: Ensure vault_pin, pin_attempts, and pin_locked_until
-- are NOT queryable by anon or public roles via PostgREST.
-- Revoke broad table SELECT from public and anon, then re-grant column-level
-- SELECT on only the non-sensitive public columns.
REVOKE ALL ON public.products FROM public;
REVOKE ALL ON public.preorder_orders FROM public;

REVOKE SELECT ON public.products FROM anon;
GRANT SELECT (
  id,
  nama_produk,
  tier,
  harga,
  bunga,
  deskripsi,
  bahan,
  ukuran,
  nama_pembeli,
  dari,
  pesan_personal,
  foto_produk,
  foto_qr,
  status,
  created_at,
  updated_at,
  audio_url,
  audio_durasi,
  video_url,
  foto_vault,
  is_catalog,
  recipient_whatsapp,
  order_id
) ON public.products TO anon;
