import { createClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from './supabaseConfig';

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.warn(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy project-hub-frontend/.env.example to .env and add your Supabase project values.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
