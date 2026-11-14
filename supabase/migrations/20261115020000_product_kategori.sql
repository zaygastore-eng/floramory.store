-- ============================================================
-- Products: kolom kategori
-- ============================================================
-- Form admin & pengelompokan koleksi di beranda memakai
-- products.kategori (lihat ffb4b0a). Tanpa kolom ini, PATCH/POST
-- produk dari panel admin gagal dengan error 42703.
-- ============================================================

alter table public.products
  add column if not exists kategori text not null default '';

comment on column public.products.kategori is
  'Kategori koleksi produk. Kosong = fallback ke kolom bunga.';

-- Migrasi 20261111000000 mencabut grant tabel anon dan hanya
-- memberikan grant per kolom katalog publik. Kolom baru ini juga
-- metadata publik, jadi ikut di-grant (bukan select *).
grant select (kategori) on public.products to anon;

notify pgrst, 'reload schema';
