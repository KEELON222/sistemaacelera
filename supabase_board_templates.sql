-- ==============================================================================
-- TABELA DE MODELOS PERSONALIZADOS DE QUADROS DO CRM
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.board_custom_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT '📋',
    stages JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
    -- Você pode descomentar a linha abaixo se quiser vincular templates a usuários específicos (se houver autenticação)
    -- , user_id UUID REFERENCES auth.users(id)
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.board_custom_templates ENABLE ROW LEVEL SECURITY;

-- Como as templates podem ser globais para o CRM por enquanto:
CREATE POLICY "Authenticated users can do everything on custom templates" 
    ON public.board_custom_templates 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);
