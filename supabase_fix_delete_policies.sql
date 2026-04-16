-- ==============================================================================
-- CORREÇÃO: FK sem CASCADE/SET NULL + políticas de DELETE faltando
-- Execute este script no Supabase SQL Editor
-- ==============================================================================

-- -----------------------------------------------------------------------
-- 1. Corrigir FK de financial_entries → clients (faltava ON DELETE CASCADE)
-- -----------------------------------------------------------------------
ALTER TABLE public.financial_entries
  DROP CONSTRAINT IF EXISTS financial_entries_client_id_fkey;

ALTER TABLE public.financial_entries
  ADD CONSTRAINT financial_entries_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

-- -----------------------------------------------------------------------
-- 2. Corrigir FKs que referenciam profiles sem ON DELETE SET NULL
--    (bloqueiam a exclusão de membros da equipe)
-- -----------------------------------------------------------------------

-- deals.assigned_to → profiles
ALTER TABLE public.deals
  DROP CONSTRAINT IF EXISTS deals_assigned_to_fkey;
ALTER TABLE public.deals
  ADD CONSTRAINT deals_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- projects.assigned_to → profiles
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_assigned_to_fkey;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- clients.created_by → profiles
ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_created_by_fkey;
ALTER TABLE public.clients
  ADD CONSTRAINT clients_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------
-- 2. Políticas de DELETE que estavam faltando
-- -----------------------------------------------------------------------

-- clients
DROP POLICY IF EXISTS "Clients deletable by authenticated users" ON public.clients;
CREATE POLICY "Clients deletable by authenticated users"
  ON public.clients FOR DELETE
  TO authenticated
  USING (true);

-- deals
DROP POLICY IF EXISTS "Deals deletable by authenticated users" ON public.deals;
CREATE POLICY "Deals deletable by authenticated users"
  ON public.deals FOR DELETE
  TO authenticated
  USING (true);

-- projects
DROP POLICY IF EXISTS "Projects deletable by authenticated users" ON public.projects;
CREATE POLICY "Projects deletable by authenticated users"
  ON public.projects FOR DELETE
  TO authenticated
  USING (true);

-- boards
DROP POLICY IF EXISTS "Boards deletable by authenticated users" ON public.boards;
CREATE POLICY "Boards deletable by authenticated users"
  ON public.boards FOR DELETE
  TO authenticated
  USING (true);
