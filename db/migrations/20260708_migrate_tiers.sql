-- Migration: Migrate product tier values and update check constraint
-- Date: 2026-07-08
-- IMPORTANT: This script creates a backup table before making changes.
-- Review before running. Run in Supabase SQL editor or psql.

BEGIN;

-- 1) Create a lightweight backup of current products table (data snapshot)
CREATE TABLE IF NOT EXISTS public.products_backup_20260708 AS
  TABLE public.products;

-- 2) Normalize tier values to the new naming used by UI
--    legacy: 'lite' -> new: 'classic'
--    legacy: 'home' -> new: 'masterpiece'
--    preserve 'signature' and normalize case/whitespace
UPDATE public.products
SET tier = CASE
  WHEN lower(trim(coalesce(tier, ''))) = 'lite' THEN 'classic'
  WHEN lower(trim(coalesce(tier, ''))) = 'home' THEN 'masterpiece'
  WHEN lower(trim(coalesce(tier, ''))) = 'signature' THEN 'signature'
  WHEN tier IS NULL OR trim(coalesce(tier, '')) = '' THEN 'classic'
  ELSE 'classic'
END
WHERE lower(trim(coalesce(tier, ''))) NOT IN ('classic', 'signature', 'masterpiece');

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
-- - This migration now normalizes common legacy values and cleans empty tier cells.
-- - If you want to keep legacy DB values and only map in the app, skip running this script.
-- - Run the SELECT verification step after the UPDATEs to confirm data looks correct before changing the constraint.
