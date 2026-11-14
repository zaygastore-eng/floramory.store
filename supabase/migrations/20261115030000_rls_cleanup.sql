-- ============================================================
-- RLS cleanup: tutup policy legacy yang terlalu longgar
-- ============================================================
-- 1) `Produk aktif bisa dilihat publik` (role public) membuat produk
--    personal aktif (is_catalog = false) tetap bisa dienumerasi anon,
--    meniadakan filter di policy `Public can read active products`.
-- 2) `Admin login bisa kelola produk` dan `Allow authenticated preorder
--    manage` memakai USING/WITH CHECK `true`, sehingga policy is_admin()
--    yang lebih baru tidak efektif (policy permissive digabung dengan OR).
-- 3) INSERT langsung oleh anon ke preorder_orders tidak dipakai lagi:
--    semua pre-order masuk lewat Edge Function send-preorder (service_role).
-- ============================================================

drop policy if exists "Produk aktif bisa dilihat publik" on public.products;
drop policy if exists "Admin login bisa kelola produk" on public.products;

drop policy if exists "Allow authenticated preorder manage" on public.preorder_orders;
drop policy if exists "Allow public preorder insert" on public.preorder_orders;

-- Admin (is_admin) tetap bisa mengelola seluruh pre-order lewat panel.
drop policy if exists "Admins can manage preorder orders" on public.preorder_orders;
create policy "Admins can manage preorder orders"
  on public.preorder_orders for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Anon tidak perlu menulis langsung ke tabel pesanan.
revoke insert on public.preorder_orders from anon;

notify pgrst, 'reload schema';
