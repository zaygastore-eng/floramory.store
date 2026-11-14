-- ============================================================
-- Migration: Galeri multi-foto produk (View Folio)
-- ============================================================
-- 1. Kolom baru `gallery_photos` untuk foto tambahan produk katalog.
--    Dipisahkan dari `vault_photos` (foto Memory Vault milik pembeli)
--    agar data privat vault tidak pernah ikut terekspos ke publik.

alter table public.products
  add column if not exists gallery_photos text[] not null default '{}'::text[];

comment on column public.products.gallery_photos is
  'Foto galeri tambahan produk katalog (maks. 4) yang tampil di halaman detail/folio.';

-- 2. Batasi maksimal 4 foto tambahan.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_gallery_photos_len'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_gallery_photos_len
      check (
        array_length(gallery_photos, 1) is null
        or array_length(gallery_photos, 1) <= 4
      );
  end if;
end $$;

-- 3. Izinkan anon membaca kolom galeri. Policy publik tetap membatasi
--    baris hanya untuk produk aktif dengan is_catalog = true, sehingga
--    produk personal (Memory Vault) tidak dapat dibaca.
grant select (gallery_photos) on public.products to anon;
