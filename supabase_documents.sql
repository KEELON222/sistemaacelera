-- Criação da estrutura para Documentos e Pastas
CREATE TABLE IF NOT EXISTS public.document_folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    folder_id UUID REFERENCES public.document_folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    size_bytes BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS para Pastas
ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Folders: read for all" ON public.document_folders FOR SELECT USING (true);
CREATE POLICY "Folders: insert for authenticated" ON public.document_folders FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Folders: update for authenticated" ON public.document_folders FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Folders: delete for authenticated" ON public.document_folders FOR DELETE USING (auth.role() = 'authenticated');

-- RLS para Documentos
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Documents: read for all" ON public.documents FOR SELECT USING (true);
CREATE POLICY "Documents: insert for authenticated" ON public.documents FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Documents: update for authenticated" ON public.documents FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Documents: delete for authenticated" ON public.documents FOR DELETE USING (auth.role() = 'authenticated');
