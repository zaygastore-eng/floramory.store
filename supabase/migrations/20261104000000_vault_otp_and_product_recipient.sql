-- 1. Link physical gift products to their recipient and source order.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS recipient_whatsapp text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.preorder_orders(id) ON DELETE SET NULL;

-- 2. OTP storage for unlocking Memory Vault.
CREATE TABLE IF NOT EXISTS public.vault_otp (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  otp_code    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  used        boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_vault_otp_lookup
  ON public.vault_otp (product_id, created_at DESC);

-- RLS: Only accessible via service_role in edge functions.
ALTER TABLE public.vault_otp ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vault_otp FROM anon, authenticated;
GRANT ALL ON public.vault_otp TO service_role;
