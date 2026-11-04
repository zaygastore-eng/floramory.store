-- Remove product image objects when a product is hard-deleted.
CREATE OR REPLACE FUNCTION public.cleanup_product_storage_objects()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'product-images'
    AND (
      left(name, char_length(OLD.id) + 1) = OLD.id || '/'
      OR name = OLD.id || '.webp'
    );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS tr_cleanup_product_storage ON public.products;
CREATE TRIGGER tr_cleanup_product_storage
  AFTER DELETE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_product_storage_objects();
