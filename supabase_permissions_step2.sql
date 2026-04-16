-- ==============================================================================
-- PASSO 2: Rode DEPOIS de ter rodado o Passo 1 com sucesso
-- ==============================================================================

-- Add permissions column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;

-- Give admins all permissions
UPDATE public.profiles SET permissions = '{
  "dashboard": true,
  "crm": true,
  "clients": true,
  "operations": true,
  "finance": true,
  "chat": true,
  "nps": true,
  "settings": true
}'::jsonb WHERE role = 'admin';

-- Set default role for new users
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'membro';
