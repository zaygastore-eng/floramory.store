Migration README
================

Files
-----
- `0001_schema.sql`        -> skema Supabase lengkap (tabel, RLS, policy, grant, constraint tier, seed).
- `0002_indexes.sql`       -> indeks performa untuk query yang paling sering dipakai.
- `20260708_migrate_tiers.sql` -> migrasi nilai `tier` dari label lama (`lite`/`home`) ke baru (`classic`/`masterpiece`).

Urutan
------
- Setup baru: jalankan `0001_schema.sql`, lalu `0002_indexes.sql` di Supabase SQL editor.
- Upgrade dari DB lama: jalankan `0001_schema.sql` dulu (membuat/menormalkan schema),
  kemudian `20260708_migrate_tiers.sql` untuk menyesuaikan data `tier` lama, lalu `0002_indexes.sql`.

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
