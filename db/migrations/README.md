Migration README
=================

File: `db/migrations/20260708_migrate_tiers.sql`

Purpose
-------
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

Questions or help
-----------------
If you want I can:
- run verification queries for you and share the results (you must paste the query results here), or
- produce a rollback script tailored to a specific subset of products.
