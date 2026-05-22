ALTER TABLE public.ai_receptionist_settings
  ADD COLUMN IF NOT EXISTS system_prompt text,
  ADD COLUMN IF NOT EXISTS system_prompt_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS system_prompt_updated_by uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS elevenlabs_agent_id text;

UPDATE public.ai_receptionist_settings
  SET elevenlabs_agent_id = COALESCE(elevenlabs_agent_id, 'agent_9201krh79bg2f9rvnxc11wj0erys');