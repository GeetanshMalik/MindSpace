// Supabase Configuration
// 
// INSTRUCTIONS:
// 1. Copy this file to config.ts
// 2. Replace the placeholder values with your Supabase project credentials
// 3. Never commit config.ts to version control

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://your-project.supabase.co';
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
