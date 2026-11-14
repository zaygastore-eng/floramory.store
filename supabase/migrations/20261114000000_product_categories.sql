-- ============================================================
-- Migration: Add product categories & allow public reading
-- ============================================================
-- 1. Pastikan key 'product_categories' diizinkan dibaca publik di app_settings
--    agar frontend (katalog & form pemesanan) bisa memuat kategori dinamis tanpa login.

drop policy if exists "Public can read app settings" on public.app_settings;
create policy "Public can read app settings"
  on public.app_settings for select
  to anon, authenticated
  using (key in ('wa_number', 'product_categories'));

-- 2. Berikan default kategori awal jika belum ada
insert into public.app_settings (key, value)
values (
  'product_categories',
  '[{"id":"keychain","name":"Keychain"},{"id":"bag_charm","name":"Bag Charm"}]'
)
on conflict (key) do nothing;
