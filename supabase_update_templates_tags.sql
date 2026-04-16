-- ==============================================================================
-- ADICIONA SUPORTE A TAGS NOS MODELOS PERSONALIZADOS
-- ==============================================================================

ALTER TABLE public.board_custom_templates 
ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;
