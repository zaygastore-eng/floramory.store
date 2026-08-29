-- ============================================================
-- Floramory — Migration 0003: Batasi akses admin via RLS
-- ============================================================
-- Masalah: policy "Authenticated admin can manage ..." sebelumnya memakai
-- `using (true)`, sehingga SEMUA akun yang login (authenticated) bisa
-- membaca, mengubah, dan menghapus data (products, preorder_orders,
-- app_settings). Ini terlalu luas.
--
-- Solusi: batasi hanya untuk user yang terdaftar di tabel admin_users,
-- diuji lewat fungsi security definer is_admin() yang membaca auth.uid().
--
-- Cara pakai (database yang sudah menjalankan 0001_schema.sql):
--   1) Jalankan seluruh file ini di Supabase SQL Editor.
--   2) Daftarkan admin: insert into public.admin_users (id)
--        select id from auth.users where email = 'EMAIL_ADMIN_KAMU';
--      (Wajib lewat SQL Editor / service_role, tabel dikunci RLS.)
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tabel admin_users (dikunci total, hanya service_role/pemilik)
-- ------------------------------------------------------------
create table if not exists public.admin_users (
  id         uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Pastikan tidak ada policy yang membocorkan tabel ini.
drop policy if exists "Admin users visible to all" on public.admin_users;
drop policy if exists "Admin users manage" on public.admin_users;

-- ------------------------------------------------------------
-- 2) Fungsi is_admin() — security definer, membaca auth.uid()
-- ------------------------------------------------------------
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

-- Cabut execute dari PUBLIC agar tidak bisa dipanggil sembarangan
-- (fungsional, bukan langkah keamanan pada policy itu sendiri).
revoke execute on function public.is_admin() from public;
revoke execute on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

-- ------------------------------------------------------------
-- 3) Perketat policy products
-- ------------------------------------------------------------
drop policy if exists "Authenticated admin can manage products" on public.products;
create policy "Authenticated admin can manage products"
  on public.products for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------
-- 4) Perketat policy preorder_orders
-- ------------------------------------------------------------
drop policy if exists "Authenticated admin can manage preorder" on public.preorder_orders;
create policy "Authenticated admin can manage preorder"
  on public.preorder_orders for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------
-- 5) Perketat policy app_settings
-- ------------------------------------------------------------
-- a) BACA publik: batasi hanya key wa_number (nomor WA kontak).
--    Policy lama `using (true)` membuka SEMUA key — jika nanti ada
--    setting sensitif, data tersebut ikut bocor ke publik.
drop policy if exists "Public can read app settings" on public.app_settings;
create policy "Public can read app settings"
  on public.app_settings for select
  to anon, authenticated
  using (key in ('wa_number'));

-- b) KELOLA: hanya admin tersimpan (admin_users) yang boleh ubah.
drop policy if exists "Authenticated admin can manage app settings" on public.app_settings;
create policy "Authenticated admin can manage app settings"
  on public.app_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- Selesai. Setelah menjalankan file ini, WAJIB daftarkan admin:
--   insert into public.admin_users (id)
--   select id from auth.users where email = 'EMAIL_ADMIN_KAMU';
-- ============================================================
