-- ============================================================
-- Floramory — Supabase schema (single source of truth)
-- ============================================================
-- Jalankan SELURUH file ini sekali di Supabase:
--   Dashboard -> SQL Editor -> New query -> paste -> Run
-- Script ini idempotent (aman dijalankan ulang).
--
-- Membuat tabel, RLS, policy, grant, constraint tier, dan data awal.
--
-- KEAMANAN: sejak skema ini, publik TIDAK bisa menulis ke tabel
-- preorder_orders langsung (anti-spam). Pre-order hanya masuk lewat
-- Supabase Edge Function `send-preorder` (supabase/functions/), yang
-- berjalan dengan service_role dan menerapkan rate limit, proteksi
-- bot (honeypot + time-trap), serta validasi server.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tabel products
-- ------------------------------------------------------------
create table if not exists public.products (
  id              text primary key,
  nama_produk     text not null default '',
  tier            text not null default 'classic',
  harga           text not null default '',
  bunga           text not null default '',
  deskripsi       text not null default '',
  bahan           text not null default '',
  ukuran          text not null default '',
  nama_pembeli    text not null default '',
  dari            text not null default '',
  pesan_personal  text not null default '',
  foto_produk     text not null default '',
  foto_qr         text not null default '',
  status          text not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Constraint tier: hanya tiga nilai yang dipakai UI.
alter table public.products drop constraint if exists products_tier_check;
alter table public.products
  add constraint products_tier_check check (tier in ('classic','signature','masterpiece'));

alter table public.products drop constraint if exists products_status_check;
alter table public.products
  add constraint products_status_check check (status in ('active','archived'));

-- ------------------------------------------------------------
-- 2) Tabel preorder_orders
-- ------------------------------------------------------------
create table if not exists public.preorder_orders (
  id               uuid primary key default gen_random_uuid(),
  customer_name    text not null default '',
  whatsapp         text not null default '',
  product_id       text not null default '',
  product_name     text not null default '',
  custom_request   text not null default '',
  recipient_name   text not null default '',
  sender_name      text not null default '',
  personal_message text not null default '',
  status           text not null default 'new',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3) Tabel app_settings
-- ------------------------------------------------------------
create table if not exists public.app_settings (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3a) Tabel admin_users & helper is_admin()
-- ------------------------------------------------------------
-- Daftar akun (auth.users) yang sah sebagai admin. Hanya pemilik DB
-- (security definer / service_role / SQL Editor) yang boleh memasukkan
-- id ke tabel ini — tabel tidak diberi policy akses sama sekali, sehingga
-- pengguna biasa/masih login pun tidak bisa membaca atau mengisinya.
create table if not exists public.admin_users (
  id         uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Fungsi ini membaca admin_users dengan hak security definer (melewati RLS),
-- dan mengembalikan true hanya jika auth.uid() terdaftar sebagai admin.
-- Dipakai di policy untuk membatasi akses kelola hanya untuk admin.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.admin_users where id = auth.uid()
  );
$$;


-- ------------------------------------------------------------
-- 4) Aktifkan Row Level Security
-- ------------------------------------------------------------
alter table public.products         enable row level security;
alter table public.preorder_orders  enable row level security;
alter table public.app_settings     enable row level security;
alter table public.admin_users      enable row level security;

-- ------------------------------------------------------------
-- 5) Policy
-- ------------------------------------------------------------
-- products: publik hanya melihat yang active; hanya admin terdaftar yang kelola semua
drop policy if exists "Public can read active products" on public.products;
drop policy if exists "Authenticated admin can manage products" on public.products;

create policy "Public can read active products"
  on public.products for select
  to anon, authenticated
  using (status = 'active');

create policy "Authenticated admin can manage products"
  on public.products for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- preorder_orders: PRIVASI. Data berisi kontak & pesan pribadi
-- (whatsapp, personal_message, recipient_name, dsb).
--   - anon          : TIDAK punya akses apa pun (tanpa grant).
--   - authenticated : baris HANYA boleh dibaca/diubah oleh admin
--                     terdaftar. Policy di bawah memakai is_admin()
--                     sebagai barikade, jadi user yang cuma login
--                     biasa tetap tidak bisa membaca data pribadi.
--   - insert        : hanya lewat Supabase Edge Function
--                     `send-preorder` (service_role, melewati RLS)
--                     yang menerapkan rate limit, proteksi bot
--                     (honeypot/time-trap), serta validasi server.
--   - delete        : tidak dipakai aplikasi (produk di-archive lewat
--                     PATCH status), jadi privilege-nya tidak diberikan.
-- Privilege SELECT & UPDATE diberikan ke `authenticated` karena proxy
-- admin (Edge Function `admin`) berjalan DENGAN TOKEN PENGUNJUNG —
-- PostgREST mengecek privilege tabel DI LUAR RLS, jadi tanpa grant
-- ini admin tidak akan bisa membaca/mengubah pre-order sama sekali.
drop policy if exists "Public can create preorder" on public.preorder_orders;
drop policy if exists "Authenticated admin can manage preorder" on public.preorder_orders;

grant select, update on public.preorder_orders to authenticated;
revoke insert, delete on public.preorder_orders from authenticated;
revoke all on public.preorder_orders from anon;

create policy "Authenticated admin can manage preorder"
  on public.preorder_orders for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Batas panjang field pre-order di level database (defense in depth).
-- Ditambahkan `not valid` agar baris lama tidak memblokir migrasi;
-- baris baru tetap wajib patuh.
alter table public.preorder_orders drop constraint if exists preorder_orders_field_lengths;
alter table public.preorder_orders
  add constraint preorder_orders_field_lengths check (
    length(customer_name)     <= 120
    and length(whatsapp)      <= 20
    and length(product_id)    <= 120
    and length(product_name)  <= 160
    and length(custom_request)  <= 2000
    and length(recipient_name)  <= 120
    and length(sender_name)     <= 120
    and length(personal_message) <= 2000
  ) not valid;

-- app_settings: publik HANYA boleh baca key tertentu (nomor WA
-- kontak: wa_number). Key lain baru/rahasia di masa depan tidak
-- terbuka ke publik; hanya admin terdaftar yang kelola semuanya.
drop policy if exists "Public can read app settings" on public.app_settings;
drop policy if exists "Authenticated admin can manage app settings" on public.app_settings;

create policy "Public can read app settings"
  on public.app_settings for select
  to anon, authenticated
  using (key in ('wa_number'));

create policy "Authenticated admin can manage app settings"
  on public.app_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------
-- 6) Grant akses untuk role anon & authenticated
-- ------------------------------------------------------------
grant usage on schema public to anon, authenticated;

-- products: publik boleh baca katalog aktif; TULIS hanya untuk
-- authenticated + dibatasi RLS is_admin() (baris non-admin tak
-- terlihat; INSERT/UPDATE juga dicek with check is_admin()).
grant select on public.products to anon, authenticated;
grant select, insert, update on public.products to authenticated;

-- app_settings: publik baca hanya key wa_number; tulis hanya admin.
grant select on public.app_settings to anon, authenticated;
grant select, insert, update on public.app_settings to authenticated;

-- preorder_orders: PRIVASI — grant-nya sudah dijelaskan di bagian
-- policy (lanjut: select/update untuk authenticated + revoke anon).

-- Berhati-hati: JANGAN jalankan 0001 versi lama setelah 0004 / setelah
-- skema ini aktif; hanya versi skema ini yang aman dipakai (pre-order
-- masuk via edge function, admin mengelola via policy is_admin()).

-- izin eksekusi is_admin(): hanya untuk authenticated (dipakai RPC & policy).
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ------------------------------------------------------------
-- 7) Data awal pengaturan
-- ------------------------------------------------------------
insert into public.app_settings (key, value)
values ('wa_number', '6281234567890')
on conflict (key) do nothing;

-- ============================================================
-- Selesai. Langkah berikutnya (WAJIB):
--   1) Jalankan supabase/migrations/20260101000004_preorder_edge_function.sql
--      (rekomendasi) atau pastikan skema di atas sudah diterapkan.
--   2) Deploy Edge Function send-preorder (supabase/functions/):
--        supabase functions deploy send-preorder
--      Pastikan env SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY tersedia.
--   3) Buat akun admin di Supabase Authentication (Users).
--   4) Daftarkan akun tsb sebagai admin (jalankan di SQL Editor,
--      karena tabel admin_users dikunci RLS dan hanya bisa diisi
--      dari sisi server/service_role):
--        insert into public.admin_users (id)
--        select id from auth.users where email = 'EMAIL_ADMIN_KAMU';
--   5) Set env VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY di Vercel.
--   6) Redeploy frontend.
-- ============================================================
