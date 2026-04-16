-- ==============================================================================
-- FIX: Permitir que Admins atualizem e excluam perfis de outros usuários
-- Rode este script no SQL Editor do Supabase
-- ==============================================================================

-- 1. Política de UPDATE para admins atualizarem qualquer perfil (role, permissions)
CREATE POLICY "Admin users can update all profiles."
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ( public.get_user_role(auth.uid()) = 'admin'::public.user_role )
  WITH CHECK ( public.get_user_role(auth.uid()) = 'admin'::public.user_role );

-- 2. Política de DELETE para admins excluírem perfis
CREATE POLICY "Admin users can delete profiles."
  ON public.profiles FOR DELETE
  TO authenticated
  USING ( public.get_user_role(auth.uid()) = 'admin'::public.user_role );
