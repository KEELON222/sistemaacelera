-- ==============================================================================
-- PASSO 1: Rode APENAS ISTO primeiro, depois rode o Passo 2
-- ==============================================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'membro';
