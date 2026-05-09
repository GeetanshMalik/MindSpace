import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://nhzngbkwjydiqmyadnyd.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_Z_NNj9b7lpXStjtCVCV61Q_XlwYp8fD';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
