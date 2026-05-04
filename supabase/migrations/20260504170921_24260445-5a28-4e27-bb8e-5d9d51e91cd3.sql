DO $$
DECLARE
  v_addon_id uuid;
  v_bath_id uuid := '697bc124-1dd0-4cdf-be5f-3123aa22eefa';
BEGIN
  SELECT id INTO v_addon_id FROM public.add_ons WHERE name = 'Nail Clipping' LIMIT 1;
  IF v_addon_id IS NULL THEN
    INSERT INTO public.add_ons (name, price, is_active, icon, description)
    VALUES ('Nail Clipping', 5, true, 'Scissors', 'Quick nail clip — keeps paws tidy and comfortable.')
    RETURNING id INTO v_addon_id;
  END IF;
  INSERT INTO public.add_on_services (add_on_id, service_id)
  VALUES (v_addon_id, v_bath_id)
  ON CONFLICT (add_on_id, service_id) DO NOTHING;
END $$;