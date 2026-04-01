/** Values are injected at build time (Vite). Set them in Vercel for production. */
export const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
export const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
