-- ============================================================
-- Migration: QRIS & Payment Proof System
-- ============================================================
-- 1. Tambah token pembayaran & kolom bukti bayar pada preorder_groups
--    dan preorder_orders.
-- 2. Izinkan publik membaca 'qris_image_url' dari app_settings agar
--    frontend dapat menampilkan barcode QRIS atelier terbaru.
-- ============================================================

-- 1) Kolom payment proof & payment token pada preorder_groups
alter table public.preorder_groups
  add column if not exists payment_token text,
  add column if not exists payment_proof_url text not null default '',
  add column if not exists payment_submitted_at timestamptz;

create index if not exists preorder_groups_payment_token_idx
  on public.preorder_groups (payment_token)
  where payment_token is not null;

-- 2) Kolom payment_proof_url pada preorder_orders (sinkron dari grup)
alter table public.preorder_orders
  add column if not exists payment_proof_url text not null default '';

-- 3) Izinkan publik membaca qris_image_url di app_settings
drop policy if exists "Public can read app settings" on public.app_settings;
create policy "Public can read app settings"
  on public.app_settings for select
  to anon, authenticated
  using (key in ('wa_number', 'product_categories', 'qris_image_url'));

-- Default nilai qris_image_url jika belum ada
insert into public.app_settings (key, value)
values ('qris_image_url', '')
on conflict (key) do nothing;

notify pgrst, 'reload schema';
