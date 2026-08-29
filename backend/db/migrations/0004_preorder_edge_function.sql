-- ============================================================
-- Floramory — Migration 0004: Kunci pre-order (anti-spam + privasi)
-- ============================================================
-- Masalah 1 (spam): policy "Public can create preorder" (with check true)
-- + `grant insert` untuk anon memungkinkan SIAPA SAJA (pengunjung
-- anonim, bot, spammer) mengirim baris langsung ke PostgREST
-- tanpa rate limit, CAPTCHA, validasi panjang input, maupun
-- validasi produk -> tabel bisa dibanjiri sampah (spam).
--
-- Masalah 2 (privasi): pre-order berisi kontak & pesan pribadi
-- (whatsapp, personal_message, recipient_name). Implementasi lama
-- memberi `authenticated` akses sambil policy `using (true)` ->
-- SEMUA user yang login bisa membaca data pribadi tersebut.
--
-- Solusi gabungan:
--   - semua pre-order WAJIB masuk lewat Supabase Edge Function
--     `send-preorder` (service_role, melewati RLS) yang menerapkan
--     rate limit (per-IP & per-nomor WA), proteksi bot (honeypot +
--     time-trap + user-agent), serta validasi server.
--   - anon & authenticated dicabut semua akses SELAIN apa yang
--     dibutuhkan proxy admin (SELECT & UPDATE untuk authenticated),
--     dan baris dibatasi policy is_admin() (hanya admin terdaftar).
--   - SKEMA LAMA (0001) TIDAK boleh dijalankan ulang setelah ini.
--
-- Cara pakai:
--   1) Jalankan file ini di Supabase SQL Editor.
--   2) Deploy edge function send-preorder (lihat backend/functions/).
--      Verifikasi env SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY
--      tersedia (secara default otomatis disediakan).
--   3) Redeploy frontend (createPreOrder kini memanggil fungsi).
-- ============================================================

-- ------------------------------------------------------------
-- 1) Kunci jalur anon / authenticated ke preorder_orders
-- ------------------------------------------------------------
-- a) Anti-spam: tutup insert publik.
-- b) PRIVASI: anon tanpa akses apa pun; authenticated HANYA mendapat
--    SELECT & UPDATE, dan barisnya tetap dibatasi policy is_admin()
--    (bagian 3) — jadi user yang sekadar login tidak bisa membaca
--    whatsapp / pesan personal / nama penerima. DELETE tidak
--    diberikan (aplikasi memakai PATCH status, bukan delete).
--    SELECT/UPDATE WAJIB diberikan ke authenticated agar proxy admin
--    (Edge Function `admin`, token pengunjung) bisa membaca/update
--    pre-order — PostgREST mengecek privilege tabel di luar RLS.
drop policy if exists "Public can create preorder" on public.preorder_orders;

grant select, update on public.preorder_orders to authenticated;
revoke insert, delete on public.preorder_orders from authenticated;
revoke all on public.preorder_orders from anon;

-- ------------------------------------------------------------
-- 2) Pertahanan berlapis (defense in depth): panjang field
--    dibatasi di level database. Ditambahkan `not valid` agar
--    baris lama (mis. sampah spam) tidak memblokir migrasi,
--    namun baris BARU tetap wajib mematuhi batas panjang.
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- Policy admin tetap: hanya admin_users yang kelola pre-order
-- ------------------------------------------------------------
drop policy if exists "Authenticated admin can manage preorder" on public.preorder_orders;
create policy "Authenticated admin can manage preorder"
  on public.preorder_orders for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- Verifikasi setelah menerapkan:
--   select p.policyname, p.cmd, p.roles
--   from pg_policies p
--   where p.tablename = 'preorder_orders';
--   Seharusnya HANYA tersisa policy "Authenticated admin can manage
--   preorder" (role authenticated, cmd ALL).
--
--   select grantee, privilege_type
--   from information_schema.role_table_grants
--   where table_name = 'preorder_orders'
--     and grantee in ('anon','authenticated');
--   anon : (tidak ada baris)
--   authenticated : SELECT, UPDATE   <- yang diizinkan RLS is_admin()
--
-- Uji keamanan (salah satu role `authenticated`, non-admin):
--   select * from public.preorder_orders;  -- 0 baris / ditolak
-- ============================================================