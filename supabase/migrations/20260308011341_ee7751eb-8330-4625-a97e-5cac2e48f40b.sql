
CREATE OR REPLACE FUNCTION public.auto_merge_migrated_customer()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.migrated_customers
  SET 
    status = 'activated',
    activated_at = now(),
    supabase_user_id = NEW.id
  WHERE 
    LOWER(email) = LOWER(NEW.email)
    AND status != 'activated';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

CREATE TRIGGER on_auth_user_created_merge_migration
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_merge_migrated_customer();
