-- Grant explicit DELETE permission on products to authenticated users (guarded by is_admin() RLS)
GRANT DELETE ON public.products TO authenticated;

-- Allow 'dp_verified' status in preorder_orders table
ALTER TABLE public.preorder_orders DROP CONSTRAINT IF EXISTS preorder_orders_status_check;
ALTER TABLE public.preorder_orders ADD CONSTRAINT preorder_orders_status_check 
  CHECK (status IN ('new', 'waiting_dp', 'dp_verified', 'completed', 'cancelled'));
