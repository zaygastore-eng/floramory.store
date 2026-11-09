-- ============================================================
-- A Chapter — Migration: Update vault-media storage bucket
-- ============================================================
-- 1. Naikkan batas ukuran file bucket vault-media menjadi 50 MB
--    (52,428,800 bytes) agar pelanggan dapat mengunggah video kenangan
--    berkualitas tinggi (hingga 35-50 MB) tanpa ditolak oleh storage.
-- 2. Tambahkan whitelist format video (MP4, WebM, QuickTime MOV iPhone, M4V)
--    ke allowed_mime_types bucket vault-media di samping format audio.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vault-media',
  'vault-media',
  true,
  52428800, -- 50 MB limit
  ARRAY[
    -- Audio formats
    'audio/mpeg',
    'audio/mp4',
    'audio/x-m4a',
    'audio/ogg',
    'audio/wav',
    'audio/webm',
    -- Video formats
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-m4v'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'audio/mpeg',
    'audio/mp4',
    'audio/x-m4a',
    'audio/ogg',
    'audio/wav',
    'audio/webm',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-m4v'
  ];
