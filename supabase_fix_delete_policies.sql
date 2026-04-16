-- ==============================================================================
-- CORREÇÃO: Adiciona políticas de DELETE que estavam faltando
-- Execute este script no Supabase SQL Editor
-- ==============================================================================

-- Política de DELETE para clients
DROP POLICY IF EXISTS "Clients deletable by authenticated users" ON public.clients;
CREATE POLICY "Clients deletable by authenticated users"
  ON public.clients FOR DELETE
  TO authenticated
  USING (true);

-- Política de DELETE para deals (se não existir)
DROP POLICY IF EXISTS "Deals deletable by authenticated users" ON public.deals;
CREATE POLICY "Deals deletable by authenticated users"
  ON public.deals FOR DELETE
  TO authenticated
  USING (true);

-- Política de DELETE para projects (se não existir)
DROP POLICY IF EXISTS "Projects deletable by authenticated users" ON public.projects;
CREATE POLICY "Projects deletable by authenticated users"
  ON public.projects FOR DELETE
  TO authenticated
  USING (true);

-- Política de DELETE para boards (se não existir)
DROP POLICY IF EXISTS "Boards deletable by authenticated users" ON public.boards;
CREATE POLICY "Boards deletable by authenticated users"
  ON public.boards FOR DELETE
  TO authenticated
  USING (true);
