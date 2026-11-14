-- ============================================================
-- A Chapter — Migration: nomor grup pada baris pre-order
-- ============================================================
-- Panel admin membaca `group_number` langsung dari preorder_orders
-- (denormalisasi, sama seperti group_total_amount/group_dp_amount).
-- Sebelumnya kolom ini hanya ada di preorder_groups sehingga query
-- admin gagal dengan:
--   column preorder_orders.group_number does not exist
-- ============================================================

alter table public.preorder_orders
  add column if not exists group_number text not null default '';

-- Backfill untuk order yang sudah dibuat setelah migrasi grup.
update public.preorder_orders o
set group_number = g.group_number
from public.preorder_groups g
where o.group_id = g.id
  and coalesce(o.group_number, '') = '';

comment on column public.preorder_orders.group_number is
  'Salinan nomor grup untuk tampilan admin. Kosong untuk pre-order lama.';
