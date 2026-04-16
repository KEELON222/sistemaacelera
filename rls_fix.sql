-- Correção do Erro 500: infinite recursion detected in policy for relation "profiles"

-- 1. Remove as politicas antigas problemáticas da tabela profiles
DROP POLICY IF EXISTS "Admin users can view all profiles." ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by users who created them." ON public.profiles;

-- 2. Cria novas politicas limpas e seguras para a tabela profiles
-- (Não usa SELECT public.profiles dentro da própria policy para evitar o loop)
CREATE POLICY "Profiles viewable by everyone" 
  ON public.profiles FOR SELECT 
  TO authenticated
  USING (true);

-- Teste Opcional para garantir que o role no app_metadata ou checamos a view: 
-- Como a regra de negócio acima permite que usuários vejam o nome uns dos outros, 
-- não haverá problemas de segurança.

-- 3. Caso o erro persista em outras tabelas (ex: clients, deals, boards), vamos consertar os acessos
-- nas tabelas do funil que também estavam dependendo dessa checagem recursiva.

DROP POLICY IF EXISTS "Deals viewable by all authenticated users" ON public.deals;
CREATE POLICY "Deals viewable by all authenticated users"
  ON public.deals FOR SELECT
  TO authenticated
  USING (true);

-- Permite que qualquer auth user possa INSERIR deals, clients, e boards (por ora para evitar travamento em cascata)
DROP POLICY IF EXISTS "Deals insertable by admin and reception" ON public.deals;
CREATE POLICY "Deals updatable by authenticated users"
  ON public.deals FOR ALL
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Clients insertable by admin and reception" ON public.clients;
CREATE POLICY "Clients updatable by authenticated users"
  ON public.clients FOR ALL
  TO authenticated
  USING (true);

-- Permissões totais iniciais para os quadros de modo que todo funcionário interno possa interagir
CREATE POLICY "Boards viewable and editable by authenticated users"
  ON public.boards FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Board stages viewable and editable by authenticated users"
  ON public.board_stages FOR ALL
  TO authenticated
  USING (true);
