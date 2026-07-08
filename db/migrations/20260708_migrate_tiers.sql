-- Migration: Migrate product tier values and update check constraint
-- Date: 2026-07-08
-- IMPORTANT: This script creates a backup table before making changes.
-- Review before running. Run in Supabase SQL editor or psql.

BEGIN;

-- 1) Create a lightweight backup of current products table (data snapshot)
CREATE TABLE IF NOT EXISTS public.products_backup_20260708 AS
  TABLE public.products;

-- 2) Update legacy tier values to the new naming used by UI
--    legacy: 'lite' -> new: 'classic'
--    legacy: 'home' -> new: 'masterpiece'
UPDATE public.products
  SET tier = 'classic'
  WHERE tier = 'lite';

UPDATE public.products
  SET tier = 'masterpiece'
  WHERE tier = 'home';

-- 3) Verify counts per tier (optional quick check)
-- SELECT tier, count(*) FROM public.products GROUP BY tier ORDER BY tier;

-- 4) Replace existing check constraint with one that accepts the new tier names
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_tier_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_tier_check CHECK (tier IN ('classic','signature','masterpiece'));

COMMIT;

-- If anything goes wrong you can revert using the backup table:
-- BEGIN;
-- TRUNCATE public.products;
-- INSERT INTO public.products SELECT * FROM public.products_backup_20260708;
-- ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_tier_check;
-- ALTER TABLE public.products ADD CONSTRAINT products_tier_check CHECK (tier IN ('lite','signature','home'));
-- COMMIT;

-- Notes:
-- - This migration assumes the only legacy values used were 'lite','signature','home'.
-- - If you want to keep legacy DB values and only map in the app, skip running this script.
-- - Run the SELECT verification step after the UPDATEs to confirm data looks correct before changing the constraint.
