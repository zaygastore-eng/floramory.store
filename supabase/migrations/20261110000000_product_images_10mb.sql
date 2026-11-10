-- ============================================================
-- A Chapter — Migration: Batas foto vault 10 MB
-- ============================================================
-- Foto polaroid pelanggan disimpan di bucket `product-images`
-- pada folder `vault/{order_id}/polaroid.<ext>`.
-- Batas bucket sebelumnya 5 MB, sementara formulir Vault Setup
-- menerima foto hingga 10 MB (foto kamera ponsel modern).
--
-- Migrasi ini menaikkan batas bucket menjadi 10 MB tanpa
-- mengubah daftar MIME gambar yang sudah diizinkan.
-- ============================================================

UPDATE storage.buckets
SET file_size_limit = 10485760 -- 10 MB
WHERE id = 'product-images';

-- Pastikan seluruh format foto yang didukung formulir masuk whitelist.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif'
]
WHERE id = 'product-images';
