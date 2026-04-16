-- ==============================================================================
-- TABELAS FINANCEIRAS
-- ==============================================================================

-- Categorias de entrada/despesa (editáveis pelo usuário)
CREATE TABLE IF NOT EXISTS public.financial_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('entrada', 'despesa')),
    color TEXT DEFAULT '#3b82f6',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir categorias padrão
INSERT INTO public.financial_categories (name, type, color) VALUES
    ('Serviço Prestado', 'entrada', '#10b981'),
    ('Venda de Produto', 'entrada', '#3b82f6'),
    ('Comissão', 'entrada', '#8b5cf6'),
    ('Reembolso', 'entrada', '#f59e0b'),
    ('Outro (Entrada)', 'entrada', '#6366f1'),
    ('Aluguel', 'despesa', '#ef4444'),
    ('Salários', 'despesa', '#f97316'),
    ('Marketing', 'despesa', '#ec4899'),
    ('Ferramentas/Software', 'despesa', '#8b5cf6'),
    ('Impostos', 'despesa', '#dc2626'),
    ('Outro (Despesa)', 'despesa', '#64748b')
ON CONFLICT DO NOTHING;

-- Entradas financeiras (receitas e despesas)
CREATE TABLE IF NOT EXISTS public.financial_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('entrada', 'despesa')),
    category_id UUID REFERENCES public.financial_categories(id),
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado')),
    client_id UUID REFERENCES public.clients(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated - categories" ON public.financial_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated - entries" ON public.financial_entries FOR ALL USING (true) WITH CHECK (true);
