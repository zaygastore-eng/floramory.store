-- Add the recipient's WhatsApp number collected from the sender at order time.
ALTER TABLE public.preorder_orders
  ADD COLUMN IF NOT EXISTS recipient_whatsapp text NOT NULL DEFAULT '';

-- Extend the existing length-check constraint to include the new column.
ALTER TABLE public.preorder_orders
  DROP CONSTRAINT IF EXISTS preorder_orders_field_lengths;

ALTER TABLE public.preorder_orders
  ADD CONSTRAINT preorder_orders_field_lengths CHECK (
    length(customer_name)        <= 120
    AND length(whatsapp)         <= 20
    AND length(product_id)       <= 120
    AND length(product_name)     <= 160
    AND length(custom_request)   <= 2000
    AND length(recipient_name)   <= 120
    AND length(sender_name)      <= 120
    AND length(personal_message) <= 2000
    AND length(recipient_whatsapp) <= 20
  ) NOT VALID;
