-- ============================================================
-- A Chapter — Migration: Vault security hardening
-- ============================================================
-- Menutup tiga masalah keamanan utama:
--
-- 1) Isi Memory Vault (surat, foto, audio, video, nama penerima)
--    sebelumnya dapat dibaca siapa pun lewat PostgREST karena role
--    `anon` diberi SELECT pada kolom sensitif. PIN hanya dicek di UI.
--    Sekarang `anon` hanya boleh membaca kolom katalog publik;
--    isi vault hanya keluar lewat Edge Function `vault-otp` setelah
--    PIN diverifikasi.
--
-- 2) Link `/vault-setup?token=<order_id>` memberi akses tulis penuh
--    tanpa kedaluwarsa dan tanpa lock. Sekarang pesanan memiliki
--    `vault_setup_token` acak, masa berlaku, dan `vault_locked_at`
--    yang dikunci setelah penyimpanan pertama.
--
-- 3) PIN disimpan & dibandingkan sebagai plaintext. Sekarang
--    `products.vault_pin_hash` diisi otomatis oleh trigger
--    (SHA-256 dari PIN + product id) dan dipakai untuk verifikasi.
--    Kolom `vault_pin` tetap ada agar admin dapat mencetak PIN fisik,
--    tetapi tidak lagi dipakai untuk membandingkan PIN.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Token setup terpisah + masa berlaku + lock
-- ------------------------------------------------------------
alter table public.preorder_orders
  add column if not exists vault_setup_token text,
  add column if not exists vault_setup_expires_at timestamptz,
  add column if not exists vault_locked_at timestamptz;

-- Backfill pesanan lama dengan token acak 64 karakter hex.
update public.preorder_orders
set vault_setup_token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
where vault_setup_token is null or length(vault_setup_token) < 32;

update public.preorder_orders
set vault_setup_expires_at = now() + interval '30 days'
where vault_setup_expires_at is null;

alter table public.preorder_orders
  alter column vault_setup_token
    set default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  alter column vault_setup_expires_at
    set default (now() + interval '30 days');

create unique index if not exists preorder_orders_vault_setup_token_uidx
  on public.preorder_orders (vault_setup_token)
  where vault_setup_token is not null;

comment on column public.preorder_orders.vault_setup_token is
  'Token privat untuk membuka konsol pengirim /vault-setup. Jangan pernah diekspos ke publik.';
comment on column public.preorder_orders.vault_setup_expires_at is
  'Batas waktu pengirim masih boleh mengubah isi vault.';
comment on column public.preorder_orders.vault_locked_at is
  'Diisi saat pengirim menyimpan vault. Setelah ini perubahan ditolak sampai admin membuka kunci.';

-- ------------------------------------------------------------
-- 2) Hash PIN (SHA-256 + product id sebagai salt)
-- ------------------------------------------------------------
alter table public.products
  add column if not exists vault_pin_hash text;

create or replace function public.sync_product_vault_pin_hash()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.vault_pin is null or btrim(new.vault_pin) = '' then
    new.vault_pin_hash := null;
  else
    new.vault_pin_hash := encode(
      sha256(convert_to(btrim(new.vault_pin) || ':' || new.id, 'UTF8')),
      'hex'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists tr_sync_product_vault_pin_hash on public.products;
create trigger tr_sync_product_vault_pin_hash
  before insert or update of vault_pin, id on public.products
  for each row
  execute function public.sync_product_vault_pin_hash();

-- Backfill hash untuk produk yang sudah punya PIN.
update public.products
set vault_pin_hash = encode(
  sha256(convert_to(btrim(vault_pin) || ':' || id, 'UTF8')),
  'hex'
)
where vault_pin is not null
  and btrim(vault_pin) <> ''
  and vault_pin_hash is null;

comment on column public.products.vault_pin_hash is
  'SHA-256(PIN + ":" + product id). Dipakai Edge Function vault-otp untuk verifikasi.';

-- ------------------------------------------------------------
-- 3) Cabut akses anon ke kolom sensitif
-- ------------------------------------------------------------
-- PENTING: `REVOKE SELECT ON TABLE` hanya mencabut grant level-tabel,
-- BUKAN grant level-kolom. Migrasi 20261106000000 memberi anon grant
-- SELECT per kolom (termasuk pesan_personal/foto_vault/audio/video).
-- Karena itu kita cabut eksplisit setiap kolom, lalu berikan kembali
-- hanya kolom katalog publik. Loop ini juga otomatis menutup kolom
-- sensitif yang ditambahkan di masa depan.
revoke select on public.products from anon;

do $$
declare
  col record;
begin
  for col in
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
  loop
    execute format('revoke select (%I) on public.products from anon', col.column_name);
  end loop;
end $$;

grant select (
  id,
  nama_produk,
  tier,
  harga,
  bunga,
  deskripsi,
  bahan,
  ukuran,
  foto_produk,
  foto_qr,
  status,
  created_at,
  updated_at,
  is_catalog
) on public.products to anon;

-- Policy baca publik hanya untuk anon dan hanya katalog aktif.
-- Produk personal (is_catalog = false) tidak lagi dapat dienumerasi
-- lewat PostgREST; halaman QR-nya memakai Edge Function vault-otp.
drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
  on public.products for select
  to anon
  using (status = 'active' and coalesce(is_catalog, true) = true);

-- Pastikan role authenticated non-admin tidak mewarisi policy publik.
-- Admin tetap melihat semua baris lewat policy is_admin().
drop policy if exists "Authenticated admin can manage products" on public.products;
create policy "Authenticated admin can manage products"
  on public.products for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------
-- 4) Verifikasi cepat setelah migrasi
-- ------------------------------------------------------------
-- select grantee, column_name
-- from information_schema.column_privileges
-- where table_name = 'products' and grantee = 'anon'
-- order by column_name;
--   -> tidak boleh ada pesan_personal, foto_vault, audio_url,
--      video_url, nama_pembeli, dari, recipient_whatsapp,
--      vault_pin, vault_pin_hash, order_id.
--
-- select id, vault_setup_token is not null as has_token,
--        vault_setup_expires_at, vault_locked_at
-- from public.preorder_orders order by created_at desc limit 5;
