-- Add read_by column to track who has read each message
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS read_by UUID[] DEFAULT '{}';
