-- Add vault media and message metadata to preorder_orders.
ALTER TABLE public.preorder_orders
  ADD COLUMN IF NOT EXISTS foto_vault text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS audio_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS audio_durasi integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS vault_submitted_at timestamptz;
