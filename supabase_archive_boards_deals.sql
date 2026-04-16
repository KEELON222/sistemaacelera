-- Adiciona a coluna 'archived' na tabela boards, caso não exista
ALTER TABLE public.boards ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- Adiciona a coluna 'archived' na tabela deals, caso não exista
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;
