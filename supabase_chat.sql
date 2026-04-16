-- ==============================================================================
-- TABELA DE MENSAGENS DO CHAT INTERNO
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES auth.users(id),
    sender_name TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'geral',  -- 'geral' for group chat, or recipient user ID for DMs
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can do everything on chat" ON public.chat_messages FOR ALL USING (true) WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON public.chat_messages(channel, created_at);
