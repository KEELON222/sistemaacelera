import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL or Anon Key is missing from environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'admin' | 'membro' | 'reception_sales' | 'finance';

export interface UserPermissions {
  dashboard?: boolean;
  crm?: boolean;
  clients?: boolean;
  operations?: boolean;
  finance?: boolean;
  chat?: boolean;
  nps?: boolean;
  settings?: boolean;
}

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  is_verified: boolean;
  verification_code: string | null;
  created_at: string;
  permissions?: UserPermissions;
}
