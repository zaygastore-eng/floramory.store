Migration README
================

Files
-----
- `0001_schema.sql`        -> skema Supabase lengkap (tabel, RLS, policy, grant, constraint tier, seed, admin_users + is_admin).
- `0002_indexes.sql`       -> indeks performa untuk query yang paling sering dipakai.
- `0003_admin_rls.sql`     -> (incremental) batasi akses admin: policy kelola hanya untuk user di `admin_users` via `public.is_admin()`; sekaligus batasi BACA publik `app_settings` hanya untuk key `wa_number`.
- `0004_preorder_edge_function.sql` -> (incremental) kunci `preorder_orders`: anti-spam (tutup insert publik, semua pre-order lewat Edge Function `send-preorder`) + PRIVASI (anon tanpa akses; authenticated hanya `select/update` dibatasi policy `is_admin()`, jadi user biasa yang login tidak bisa membaca data pribadi pre-order).
- `0005_product_images_storage.sql` -> (incremental) bucket storage `product-images` (publik, maks. 5 MB, hanya gambar) + RLS storage: anon & authenticated hanya bisa baca; upload/update/delete HANYA lewat sesi admin (`is_admin()`). Mendukung CDN Image Transform (WebP/AVIF) di frontend.
- `20260708_migrate_tiers.sql` -> migrasi nilai `tier` dari label lama (`lite`/`home`) ke baru (`classic`/`masterpiece`).

Urutan
------
- Setup baru: jalankan `0001_schema.sql`, lalu `0002_indexes.sql` di Supabase SQL editor.
- Upgrade dari DB lama: jalankan `0001_schema.sql` dulu (membuat/menormalkan schema),
  kemudian `20260708_migrate_tiers.sql` untuk menyesuaikan data `tier` lama, lalu `0002_indexes.sql`.
- Migrasi RLS admin (`0003_admin_rls.sql`): jalankan setelah itu untuk menutup celah
  akses admin yang terlalu luas. Untuk DB yang sudah lama (built-in `is_admin()` sudah ada dari `0001` terbaru), file ini idempotent.
- Migrasi anti-spam & privasi (`0004_preorder_edge_function.sql`): wajib dijalankan SETELAH
  `0001_schema.sql` versi baru. Menutup insert publik ke `preorder_orders` dan mencabut
  akses baca non-admin — setelah ini JANGAN jalankan ulang skema lama (0001 versi lama)
  karena akan membuka kembali jalur spam & kebocoran privasi. Deploy Edge Function
  `send-preorder` (supabase/functions/) setelahnya.
- Migrasi storage (`0005_product_images_storage.sql`): buat bucket `product-images` + RLS
  storage. Aman dijalankan kapan saja (idempotent). Setelahnya redepoy Edge Function `admin`
  agar upload foto dari panel admin bekerja (proxy storage + batas 6 MB). File FOTO lama
  yang berupa URL eksternal (imgbb/Dribbble/dll.) TETAP tampil — hanya tidak di-optimasi CDN;
  untuk hasil terbaik, unggah ulang lewat tombol "Unggah & Optimasi" di panel admin.
- Catatan privasi (`preorder_orders`): data berisi kontak & pesan pribadi. Status aman
  dicapai lewat KOMBINASI privilege + RLS:
  - `anon` : tanpa grant apa pun -> tidak bisa membaca/menulis.
  - `authenticated` : hanya `select, update` — dan policy `using (is_admin())` memastikan
    hanya admin tersimpan yang bisa membuka baris; user yang login biasa dapat 0 baris.
  - latency admin `products`/`app_settings`: `select` publik + `insert/update` hanya
    authenticated (RLS is_admin) — proxy admin `admin` berjalan dengan token pengunjung,
    jadi privilege ini WAJIB ada agar CRUD admin bekerja.
  - Verifikasi: `select * from information_schema.role_table_grants where table_name in ('preorder_orders','products','app_settings') and grantee in ('anon','authenticated');`

Admin (WAJIB setelah setup / migrasi)
-------------------------------------
Akses kelola dibatasi hanya untuk user yang terdaftar di tabel `public.admin_users`.
Daftarkan akun admin lewat SQL Editor (tabel dikunci RLS, tidak bisa diisi dari aplikasi):

```sql
insert into public.admin_users (id)
select id from auth.users where email = 'EMAIL_ADMIN_KAMU';
```

Tanpa langkah ini, akun yang login TIDAK akan bisa mengakses data admin.

Purpose (20260708_migrate_tiers.sql)
------------------------------------
Migrate product `tier` values from legacy labels (`lite`, `signature`, `home`) to the new labels used in the UI (`classic`, `signature`, `masterpiece`) and update the `products_tier_check` constraint accordingly.

How to run (Supabase SQL editor)
--------------------------------
1. Open your Supabase project and go to SQL Editor.
2. Copy the entire contents of `20260708_migrate_tiers.sql` and paste into a new query.
3. (Recommended) Run the verification query first to inspect current values:

   SELECT tier, count(*) FROM public.products GROUP BY tier ORDER BY tier;

4. Run the migration script.
5. After completion, re-run the verification query to confirm tiers look correct.

Rollback (if needed)
--------------------
The migration script creates a backup table named `products_backup_20260708`.
To revert to the original state run (in SQL editor):

BEGIN;
TRUNCATE public.products;
INSERT INTO public.products SELECT * FROM public.products_backup_20260708;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_tier_check;
ALTER TABLE public.products ADD CONSTRAINT products_tier_check CHECK (tier IN ('lite','signature','home'));
COMMIT;

Notes & safety
--------------
- The migration updates existing rows in-place; the backup table is a snapshot of `public.products` before changes.
- Make sure no other systems rely on the old tier values before switching the constraint.
- If your application still maps UI values to legacy DB values (the app contains such mapping), coordinate deployment so the app and DB change together to avoid mismatches.
- The app (frontend/src/lib/sheets.ts) expects the new tier labels (`classic`/`signature`/`masterpiece`) as enforced by `0001_schema.sql`. It keeps a small retry safety net if a constraint error occurs, but the schema constraint is the source of truth.

Questions or help
-----------------
If you want I can:
- run verification queries for you and share the results (you must paste the query results here), or
- produce a rollback script tailored to a specific subset of products.
