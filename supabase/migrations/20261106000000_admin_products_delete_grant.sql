-- Grant explicit DELETE permission on products to authenticated users (guarded by is_admin() RLS)
GRANT DELETE ON public.products TO authenticated;
