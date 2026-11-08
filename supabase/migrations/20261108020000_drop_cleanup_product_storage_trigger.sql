-- Drop the trigger that attempted direct deletion from storage.objects
DROP TRIGGER IF EXISTS tr_cleanup_product_storage ON public.products;
DROP FUNCTION IF EXISTS public.cleanup_product_storage_objects();
