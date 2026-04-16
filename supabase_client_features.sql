-- Add description to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS description TEXT;

-- Create client_comments table
CREATE TABLE IF NOT EXISTS public.client_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.client_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client comments viewable by all authenticated users"
  ON public.client_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Client comments insertable by authenticated users"
  ON public.client_comments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Client comments updatable by author"
  ON public.client_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Client comments deletable by author or admin"
  ON public.client_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Create client_attachments table
CREATE TABLE IF NOT EXISTS public.client_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    niche TEXT NOT NULL, -- 'Guias', 'Reuniões', 'Auditorias', 'Alinhamentos'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.client_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client attachments viewable by all authenticated users"
  ON public.client_attachments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Client attachments insertable by authenticated users"
  ON public.client_attachments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Client attachments deletable by author or admin"
  ON public.client_attachments FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Ensure storage bucket exists (if not created earlier) for attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('client_files', 'client_files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for client_files
CREATE POLICY "Client files viewable by authenticated users"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'client_files');

CREATE POLICY "Client files insertable by authenticated users"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'client_files');

CREATE POLICY "Client files updatable by authenticated users"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'client_files')
WITH CHECK (bucket_id = 'client_files');

CREATE POLICY "Client files deletable by authenticated users"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'client_files');
