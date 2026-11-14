-- ============================================================
-- A Chapter — Migration: Pre-order grup (multi-karya)
-- ============================================================
-- Satu reservasi kini bisa berisi banyak karya. Setiap karya tetap
-- menjadi SATU baris `preorder_orders` (satu QR / satu Memory Vault),
-- lalu diikat ke satu `preorder_groups` sebagai satu transaksi.
--
-- DP 50% dihitung di level grup: saat admin memverifikasi DP grup,
-- semua item di grup ikut menjadi `dp_verified` sehingga gate vault
-- yang sudah ada tetap bekerja tanpa perubahan.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tabel grup pre-order
-- ------------------------------------------------------------
create table if not exists public.preorder_groups (
  id             uuid primary key default gen_random_uuid(),
  group_number   text unique,
  customer_name  text not null default '',
  whatsapp       text not null default '',
  is_vip         boolean not null default false,
  total_amount   numeric(12, 0) not null default 0,
  dp_amount      numeric(12, 0) not null default 0,
  status         text not null default 'waiting_dp',
  dp_verified_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists preorder_groups_whatsapp_idx
  on public.preorder_groups (whatsapp);

create index if not exists preorder_groups_created_at_idx
  on public.preorder_groups (created_at desc);

-- ------------------------------------------------------------
-- 2) Kolom penghubung + data terstruktur per karya
-- ------------------------------------------------------------
alter table public.preorder_orders
  add column if not exists group_id   uuid references public.preorder_groups(id) on delete set null,
  add column if not exists nuansa     text not null default '',
  add column if not exists inisial    text not null default '',
  add column if not exists group_item_index integer not null default 1,
  add column if not exists group_item_count integer not null default 1,
  -- Salinan total & DP grup di tiap item agar panel admin bisa
  -- menampilkan ringkasan grup tanpa query tambahan.
  add column if not exists group_total_amount numeric(12, 0) not null default 0,
  add column if not exists group_dp_amount numeric(12, 0) not null default 0;

create index if not exists preorder_orders_group_id_idx
  on public.preorder_orders (group_id);

-- ------------------------------------------------------------
-- 3) Keamanan: hanya admin terdaftar yang boleh baca/ubah grup.
--    Insert hanya lewat Edge Function `send-preorder` (service_role).
-- ------------------------------------------------------------
alter table public.preorder_groups enable row level security;

revoke all on public.preorder_groups from anon, authenticated;
grant select, update on public.preorder_groups to authenticated;

drop policy if exists "Authenticated admin can manage preorder groups" on public.preorder_groups;
create policy "Authenticated admin can manage preorder groups"
  on public.preorder_groups for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

comment on table public.preorder_groups is
  'Satu transaksi reservasi; berisi satu atau banyak karya di preorder_orders.';
comment on column public.preorder_orders.group_id is
  'Grup transaksi. NULL untuk pre-order lama (single item).';
comment on column public.preorder_orders.nuansa is
  'Nuansa warna pilihan untuk karya ini (crimson-romance / bridgerton-blue / classic-ivory).';
comment on column public.preorder_orders.inisial is
  'Inisial monogram untuk karya ini.';
