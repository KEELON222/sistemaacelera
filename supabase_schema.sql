-- Supabase Schema for Sistema Acelerai

-- 1. Create custom enum types for roles and statuses
CREATE TYPE user_role AS ENUM ('admin', 'reception_sales', 'finance');
CREATE TYPE deal_status AS ENUM ('contato', 'avaliacao', 'fechado', 'perdido');
CREATE TYPE invoice_status AS ENUM ('pendente', 'pago', 'atrasado', 'cancelado');

-- 2. Create Profiles table (extends auth.users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT NOT NULL,
    role user_role DEFAULT 'reception_sales'::user_role NOT NULL,
    avatar_url TEXT,
    is_verified BOOLEAN DEFAULT false NOT NULL,
    verification_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by users who created them."
  ON public.profiles FOR SELECT
  USING ( auth.uid() = id );

-- Helper function to avoid infinite recursion when checking roles
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS public.user_role AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE POLICY "Admin users can view all profiles."
  ON public.profiles FOR SELECT
  USING ( public.get_user_role(auth.uid()) = 'admin'::public.user_role );

CREATE POLICY "Users can update own profile."
  ON public.profiles FOR UPDATE
  USING ( auth.uid() = id )
  WITH CHECK ( auth.uid() = id );

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Novo Usuário'), 
    COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'reception_sales'::public.user_role)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to call the function on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Clients table
CREATE TABLE public.clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    origin TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
-- Everyone in reception_sales and admin can read/write clients. Finance can read.
CREATE POLICY "Clients viewable by all authenticated users"
  ON public.clients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Clients insertable by admin and reception"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK ( EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'reception_sales')
  ));

CREATE POLICY "Clients updatable by admin and reception"
  ON public.clients FOR UPDATE
  TO authenticated
  USING ( EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'reception_sales')
  ));

-- 4. Deals (Kanban Funnel)
CREATE TABLE public.deals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    value NUMERIC(10,2) DEFAULT 0.00,
    status deal_status DEFAULT 'contato'::deal_status NOT NULL,
    assigned_to UUID REFERENCES public.profiles(id),
    expected_close_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deals viewable by all authenticated users"
  ON public.deals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Deals insertable by admin and reception"
  ON public.deals FOR INSERT
  TO authenticated
  WITH CHECK ( EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'reception_sales')
  ));

CREATE POLICY "Deals updatable by admin and reception"
  ON public.deals FOR UPDATE
  TO authenticated
  USING ( EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'reception_sales')
  ));

-- 5. Invoices (Finance)
CREATE TABLE public.invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
    amount NUMERIC(10,2) NOT NULL,
    due_date DATE NOT NULL,
    status invoice_status DEFAULT 'pendente'::invoice_status NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invoices viewable by admin and finance"
  ON public.invoices FOR SELECT
  TO authenticated
  USING ( EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'finance')
  ));

CREATE POLICY "Invoices modifiable by admin and finance"
  ON public.invoices FOR ALL
  TO authenticated
  USING ( EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'finance')
  ));
  
-- Create storage bucket for client files
-- INSERT INTO storage.buckets (id, name, public) VALUES ('client_files', 'client_files', false);

-- Helper query to update existing databases without dropping the profiles table:
-- ALTER TABLE public.profiles ADD COLUMN is_verified BOOLEAN DEFAULT false;
-- ALTER TABLE public.profiles ADD COLUMN verification_code TEXT;

-- 6. Operações (Gestão de Projetos / Fluxograma Acelerai)
CREATE TYPE project_status AS ENUM ('nao_iniciado', 'em_andamento', 'aguardando_cliente', 'concluido', 'bloqueado');

CREATE TABLE public.projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL, -- Optional link to original sale
    title TEXT NOT NULL,
    description TEXT,
    stage_id INTEGER DEFAULT 1 NOT NULL, -- 1 to 6
    status project_status DEFAULT 'nao_iniciado'::project_status NOT NULL,
    priority_tags TEXT[], -- Array to hold tags like 'ponto_critico', 'financeiro', 'dependencia'
    assigned_to UUID REFERENCES public.profiles(id),
    start_date DATE,
    deadline DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Projects viewable by all authenticated users"
  ON public.projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Projects insertable by admin and reception"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK ( EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'reception_sales')
  ));

CREATE POLICY "Projects updatable by admin and reception"
  ON public.projects FOR UPDATE
  TO authenticated
  USING ( EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'reception_sales')
  ));
