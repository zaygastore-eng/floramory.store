-- Store payment references and WhatsApp dispatch state for new pre-orders.
ALTER TABLE public.preorder_orders
  ADD COLUMN IF NOT EXISTS order_number text,
  ADD COLUMN IF NOT EXISTS total_amount numeric(12, 0),
  ADD COLUMN IF NOT EXISTS dp_amount numeric(12, 0),
  ADD COLUMN IF NOT EXISTS wa_sent boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS preorder_orders_order_number_uidx
  ON public.preorder_orders (order_number)
  WHERE order_number IS NOT NULL;
