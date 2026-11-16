-- ============================================================
-- A Chapter — Migration: Reservasi tanpa pembayaran online
-- ============================================================
-- Reservasi kini berada di halaman /reservasi. Data pengiriman
-- dikumpulkan sebagai field opsional, dan status awal grup adalah
-- "new" (menunggu konfirmasi atelier via WhatsApp).
--
-- Kolom pembayaran lama (payment_token, payment_proof_url, dp_amount)
-- sengaja tidak dihapus agar pesanan historis tetap dapat diaudit.
-- ============================================================

alter table public.preorder_orders
  add column if not exists shipping_city text not null default '',
  add column if not exists shipping_address text not null default '';

comment on column public.preorder_orders.shipping_city is
  'Kota/kecamatan tujuan pengiriman; opsional, dilengkapi via WhatsApp bila kosong.';
comment on column public.preorder_orders.shipping_address is
  'Alamat pengiriman lengkap; opsional, dilengkapi via WhatsApp bila kosong.';

alter table public.preorder_groups
  alter column status set default 'new';

notify pgrst, 'reload schema';
