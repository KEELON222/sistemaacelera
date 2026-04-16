-- Criação da tabela de tags do CRM
CREATE TABLE IF NOT EXISTS public.crm_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#E2E8F0',
    type TEXT NOT NULL CHECK (type IN ('priority', 'niche')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Permissões básicas (ajuste conforme necessário para o seu RLS)
ALTER TABLE public.crm_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.crm_tags FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.crm_tags FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users only" ON public.crm_tags FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users only" ON public.crm_tags FOR DELETE USING (auth.role() = 'authenticated');

-- Adicionando colunas de tags na tabela deals
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS priority_tags TEXT[] DEFAULT '{}';
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS niche_tags TEXT[] DEFAULT '{}';
