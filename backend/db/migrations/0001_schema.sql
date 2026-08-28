-- ============================================================
-- Floramory — Supabase schema (single source of truth)
-- ============================================================
-- Jalankan SELURUH file ini sekali di Supabase:
--   Dashboard -> SQL Editor -> New query -> paste -> Run
-- Script ini idempotent (aman dijalankan ulang).
--
-- Membuat tabel, RLS, policy, grant, constraint tier, dan data awal.
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
-- 4) Aktifkan Row Level Security
-- ------------------------------------------------------------
alter table public.products         enable row level security;
alter table public.preorder_orders  enable row level security;
alter table public.app_settings     enable row level security;

-- ------------------------------------------------------------
-- 5) Policy
-- ------------------------------------------------------------
-- products: publik hanya melihat yang active; admin (authenticated) kelola semua
drop policy if exists "Public can read active products" on public.products;
drop policy if exists "Authenticated admin can manage products" on public.products;

create policy "Public can read active products"
  on public.products for select
  to anon, authenticated
  using (status = 'active');

create policy "Authenticated admin can manage products"
  on public.products for all
  to authenticated
  using (true)
  with check (true);

-- preorder_orders: publik boleh buat; admin kelola
drop policy if exists "Public can create preorder" on public.preorder_orders;
drop policy if exists "Authenticated admin can manage preorder" on public.preorder_orders;

create policy "Public can create preorder"
  on public.preorder_orders for insert
  to anon, authenticated
  with check (true);

create policy "Authenticated admin can manage preorder"
  on public.preorder_orders for all
  to authenticated
  using (true)
  with check (true);

-- app_settings: publik boleh baca; admin kelola
drop policy if exists "Public can read app settings" on public.app_settings;
drop policy if exists "Authenticated admin can manage app settings" on public.app_settings;

create policy "Public can read app settings"
  on public.app_settings for select
  to anon, authenticated
  using (true);

create policy "Authenticated admin can manage app settings"
  on public.app_settings for all
  to authenticated
  using (true)
  with check (true);

-- ------------------------------------------------------------
-- 6) Grant akses untuk role anon & authenticated
-- ------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert on public.preorder_orders to anon, authenticated;
grant select on public.app_settings to anon, authenticated;

-- ------------------------------------------------------------
-- 7) Data awal pengaturan
-- ------------------------------------------------------------
insert into public.app_settings (key, value)
values ('wa_number', '6281234567890')
on conflict (key) do nothing;

-- ============================================================
-- Selesai. Langkah berikutnya:
--   1) Buat akun admin di Supabase Authentication (Users).
--   2) Set env VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY di Vercel.
--   3) Redeploy frontend.
-- ============================================================
