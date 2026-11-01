-- ============================================================
-- Floramory — Migration 0005: Supabase Storage foto produk
-- ============================================================
-- Temuan performa/keamanan: URL foto produk & QR sebelumnya berupa
-- string bebas (bisa menunjuk gambar besar, format lama, atau host
-- lambat). Solusi:
--   1) Bucket storage publik `product-images`: unggah (admin) & baca
--      (publik) via URL CDN supabase.co/storage/v1/object/public/...
--   2) Browse menampilkan URL tsb lewat Image Transform:
--      ?width=&height=&resize=cover&format=auto&quality= -> WebP/AVIF
--      thumbnail 600px utk katalog, 1200px utk modal/halaman scan.
--   3) Upload diberi batas ukuran 5 MB + whitelist tipe MIME gambar
--      di level bucket (dipatuhi frontend & edge function admin).
--
-- RLS storage: anon hanya baca isi bucket; unggah/perbarui/hapus
-- hanya lewat sesi admin (authenticated + is_admin()). Proxy edge
-- function `admin` (cookie HttpOnly) yang menangani upload.
--
-- Cara pakai:
--   1) Jalankan file ini di Supabase SQL Editor (bisa setelah 0001+
--      sudah diterapkan; aman dijalankan kapan saja).
--   2) Redeploy edge function `admin` (dukungan upload storage).
--   3) Upload foto dari panel admin; simpan URL yg dihasilkan.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Bucket public + limit ukuran (5 MB) & tipe MIME gambar
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ------------------------------------------------------------
-- 2) RLS pada storage.objects
-- ------------------------------------------------------------
drop policy if exists "Public read product images" on storage.objects;
drop policy if exists "Admin upload product images" on storage.objects;
drop policy if exists "Admin update product images" on storage.objects;
drop policy if exists "Admin delete product images" on storage.objects;

create policy "Public read product images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

-- Upload / update / delete: WAJIB user login dengan is_admin().
-- is_admin() membaca auth.uid() (sama seperti tabel aplikasi).
create policy "Admin upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "Admin update product images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "Admin delete product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- ============================================================
-- Verifikasi setelah menerapkan:
--   select id, name, public, file_size_limit, allowed_mime_types
--   from storage.buckets where id = 'product-images';
--
--   select policyname, cmd, roles
--   from pg_policies
--   where schemaname = 'storage' and tablename = 'objects';
--   Hanya policy product-images yang ada (baca publik + admin upload).
--
-- URL CDN hasil unggah:
--   {SUPABASE_URL}/storage/v1/object/public/product-images/{ID_PRODUK}/{produk|qr}.webp
--   + transform thymbnail otomatis oleh productImageUrl() di frontend.
-- ============================================================