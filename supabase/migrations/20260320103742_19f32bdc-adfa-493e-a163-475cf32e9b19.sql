INSERT INTO storage.buckets (id, name, public)
VALUES ('package-agreements', 'package-agreements', false)
ON CONFLICT (id) DO NOTHING;