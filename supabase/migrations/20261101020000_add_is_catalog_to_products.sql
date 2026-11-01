-- ============================================================
-- Floramory — Migration: Strict separation of public catalog vs private gift orders
-- ============================================================

-- Add catalog visibility flag to public.products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS is_catalog boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.products.is_catalog IS 'true = public storefront master product; false = private physical gift order (accessible only via direct QR link or admin)';

-- Create index for high-performance public catalog queries
CREATE INDEX IF NOT EXISTS idx_products_catalog_active
ON public.products (status, is_catalog)
WHERE status = 'active' AND is_catalog = true;
