-- ============================================================
-- Floramory — Migration: Add multimedia (video & personal photo) to products
-- ============================================================

-- Add multimedia columns for personal memory capsule
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS video_url text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS foto_vault text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.products.video_url IS 'URL for memory video: YouTube unlisted, direct MP4, or Cloudflare R2';
COMMENT ON COLUMN public.products.foto_vault IS 'URL for personal memory photo (polaroid/capsule photo, distinct from product bouquet photo)';
