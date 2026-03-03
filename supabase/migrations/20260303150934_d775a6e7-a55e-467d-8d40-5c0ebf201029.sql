
-- Table to cache AI-generated breed advice (refreshed every 24h)
CREATE TABLE public.breed_advice_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  breed_id uuid REFERENCES public.breeds(id) ON DELETE CASCADE NOT NULL,
  topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Table to store saved advice per user
CREATE TABLE public.saved_advice (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  breed_name text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  icon text DEFAULT '💡',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.breed_advice_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_advice ENABLE ROW LEVEL SECURITY;

-- breed_advice_cache: anyone authenticated can read, service role can insert/update
CREATE POLICY "Anyone can read breed advice cache" ON public.breed_advice_cache FOR SELECT USING (true);
CREATE POLICY "Service role can manage breed advice cache" ON public.breed_advice_cache FOR ALL USING (true) WITH CHECK (true);

-- saved_advice: users can manage own
CREATE POLICY "Users can read own saved advice" ON public.saved_advice FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own saved advice" ON public.saved_advice FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved advice" ON public.saved_advice FOR DELETE USING (auth.uid() = user_id);
