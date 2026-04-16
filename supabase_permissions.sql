-- ==============================================================================
-- PERMISSIONS SYSTEM
-- ==============================================================================

-- Step 1: Add 'membro' to the existing user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'membro';

-- Step 2: Add permissions JSONB column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;

-- Step 3: Update existing admin users to have all permissions
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

-- Step 4: Set default role for new users to 'membro'
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'membro';
