-- ============================================================
-- Maintenance cleanup & security hardening
-- ============================================================
-- 1. Hapus tabel backup sementara lama (snapshot migrasi 2026-07-08).
-- 2. Bersihkan token OTP vault yang sudah kedaluwarsa atau terpakai.
-- 3. Hardening hak akses: cabut insert/delete pada preorder_orders
--    dari authenticated (hanya service_role yang menginsert preorder,
--    dan admin mengelola status via update).
-- 4. Set kategori awal untuk produk katalog aktif jika masih kosong.
-- ============================================================

-- 1) Hapus backup usang
drop table if exists public.products_backup_20260708;

-- 2) Bersihkan OTP kedaluwarsa
delete from public.vault_otp
 where expires_at < now() or used = true;

-- 3) Hardening hak akses preorder_orders
revoke insert, delete on public.preorder_orders from authenticated;

-- 4) Set kategori default untuk produk katalog aktif
update public.products
   set kategori = 'Keychain'
 where id = '123'
   and coalesce(kategori, '') = '';

notify pgrst, 'reload schema';
