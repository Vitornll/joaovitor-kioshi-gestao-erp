import { createClient } from '@supabase/supabase-js';

// Chave "anon"/publicável: é segura para ir junto com o app (desktop, mobile ou web).
// Toda a proteção de dados fica a cargo das políticas de RLS no banco.
const SUPABASE_URL = 'https://vxacswsfttkpcicqbnnw.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4YWNzd3NmdHRrcGNpY3Fibm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MTg0MDksImV4cCI6MjEwOTM5NDQwOX0.FcFaQIqdkKjBuKbopfMtwdgqEAGbvzW1fAkT7CM7Zvk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
