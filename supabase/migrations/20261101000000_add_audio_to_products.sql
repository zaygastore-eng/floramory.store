-- ============================================================
-- Floramory — Migration: Add audio metadata to products & setup vault-media storage
-- ============================================================

-- ------------------------------------------------------------
-- 1. Database Migration (public.products)
-- ------------------------------------------------------------
-- Add audio metadata columns to public.products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS audio_url text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS audio_durasi integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.products.audio_url IS 'Public URL or storage path for voice note / audio message';
COMMENT ON COLUMN public.products.audio_durasi IS 'Audio duration in seconds for instant UI playback rendering';

-- ------------------------------------------------------------
-- 2. Supabase Storage Configuration (vault-media)
-- ------------------------------------------------------------
-- 1. Create dedicated storage bucket for vault media if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vault-media',
  'vault-media',
  true,
  10485760, -- 10 MB limit
  ARRAY['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/ogg', 'audio/wav', 'audio/webm']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/ogg', 'audio/wav', 'audio/webm'];

-- 2. Storage RLS Policies
DROP POLICY IF EXISTS "Public Access: Read Vault Media" ON storage.objects;
DROP POLICY IF EXISTS "Admin Access: Upload Vault Media" ON storage.objects;
DROP POLICY IF EXISTS "Admin Access: Manage Vault Media" ON storage.objects;
DROP POLICY IF EXISTS "Admin Access: Update Vault Media" ON storage.objects;

-- Allow public anonymous access to read / stream audio
CREATE POLICY "Public Access: Read Vault Media"
ON storage.objects FOR SELECT
USING (bucket_id = 'vault-media');

-- Allow authenticated admin users to upload audio files
CREATE POLICY "Admin Access: Upload Vault Media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vault-media'
  AND public.is_admin()
  AND (storage.foldername(name))[1] != 'private'
);

-- Allow authenticated admin users to update/delete audio files
CREATE POLICY "Admin Access: Manage Vault Media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'vault-media'
  AND public.is_admin()
);

CREATE POLICY "Admin Access: Update Vault Media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'vault-media'
  AND public.is_admin()
)
WITH CHECK (
  bucket_id = 'vault-media'
  AND public.is_admin()
);
