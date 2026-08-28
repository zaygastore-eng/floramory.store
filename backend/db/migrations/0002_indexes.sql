-- ============================================================
-- Floramory — Indeks performa
-- ============================================================
-- Jalankan di Supabase SQL Editor (aman dijalankan ulang).
-- Mempercepat filter/urut yang paling sering dipakai aplikasi.
-- ============================================================

-- Produk publik: filter status + urut created_at (halaman utama)
create index if not exists products_status_created_idx
  on public.products (status, created_at desc);

-- Cari produk by id (halaman QR / detail)
create index if not exists products_id_idx
  on public.products (id);

-- Cari produk by tier (tab lini produk)
create index if not exists products_tier_idx
  on public.products (tier);

-- Pre-order: urut created_at (dashboard admin)
create index if not exists preorder_orders_created_idx
  on public.preorder_orders (created_at desc);

-- Pre-order: filter status (dashboard admin)
create index if not exists preorder_orders_status_idx
  on public.preorder_orders (status);
