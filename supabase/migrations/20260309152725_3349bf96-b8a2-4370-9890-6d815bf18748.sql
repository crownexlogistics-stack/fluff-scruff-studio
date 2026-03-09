
-- Create scruff_conversations table
CREATE TABLE public.scruff_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  visitor_id TEXT,
  customer_email TEXT,
  customer_name TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  message_count INTEGER DEFAULT 0,
  was_escalated BOOLEAN DEFAULT false,
  escalated_at TIMESTAMP WITH TIME ZONE,
  device_type TEXT,
  page_started_from TEXT
);

-- Create scruff_messages table
CREATE TABLE public.scruff_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.scruff_conversations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  response_time_ms INTEGER
);

-- Create scruff_handoffs table
CREATE TABLE public.scruff_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.scruff_conversations(id) ON DELETE CASCADE NOT NULL,
  customer_name TEXT,
  customer_contact TEXT,
  customer_message TEXT,
  status TEXT DEFAULT 'pending',
  assigned_to UUID REFERENCES public.staff(id),
  assigned_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scruff_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scruff_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scruff_handoffs ENABLE ROW LEVEL SECURITY;

-- RLS for scruff_conversations: directors and managers full access
CREATE POLICY "Directors and managers can manage scruff_conversations"
ON public.scruff_conversations FOR ALL TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

-- Service role can insert (from edge function)
CREATE POLICY "Service role can insert scruff_conversations"
ON public.scruff_conversations FOR INSERT TO public
WITH CHECK (true);

-- Service role can update (from edge function)
CREATE POLICY "Service role can update scruff_conversations"
ON public.scruff_conversations FOR UPDATE TO public
USING (true);

-- RLS for scruff_messages: directors and managers full access
CREATE POLICY "Directors and managers can manage scruff_messages"
ON public.scruff_messages FOR ALL TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

-- Service role can insert messages (from edge function)
CREATE POLICY "Service role can insert scruff_messages"
ON public.scruff_messages FOR INSERT TO public
WITH CHECK (true);

-- RLS for scruff_handoffs: directors and managers full access
CREATE POLICY "Directors and managers can manage scruff_handoffs"
ON public.scruff_handoffs FOR ALL TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'director'::app_role));

-- Groomers can read their assigned handoffs
CREATE POLICY "Groomers can read assigned handoffs"
ON public.scruff_handoffs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'groomer'::app_role) AND assigned_to IN (
  SELECT id FROM public.staff WHERE auth_user_id = auth.uid()
));

-- Groomers can update their assigned handoffs
CREATE POLICY "Groomers can update assigned handoffs"
ON public.scruff_handoffs FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'groomer'::app_role) AND assigned_to IN (
  SELECT id FROM public.staff WHERE auth_user_id = auth.uid()
));

-- Service role can insert handoffs (from edge function)
CREATE POLICY "Service role can insert scruff_handoffs"
ON public.scruff_handoffs FOR INSERT TO public
WITH CHECK (true);
