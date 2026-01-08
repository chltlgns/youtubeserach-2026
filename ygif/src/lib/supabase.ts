import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for Supabase
export interface CoupangProductDB {
    id: string;
    user_id: string;
    url: string;
    product_name: string;
    current_price: number;
    original_price: number;
    discount_rate: string;
    previous_price: number | null;
    price_change_rate: string | null;
    last_updated: string;
    created_at: string;
}
