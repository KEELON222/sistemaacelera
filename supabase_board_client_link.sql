-- Add client_id to boards table (optional link)
ALTER TABLE public.boards ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
