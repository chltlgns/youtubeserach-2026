import { createClient } from '@supabase/supabase-js';

// SSR-safe: polyfill localStorage for server-side rendering
if (typeof globalThis.localStorage === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).localStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
    };
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL 환경변수가 설정되지 않았습니다.');
}
if (!supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: typeof window !== 'undefined' ? localStorage : {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        },
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
    },
});

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
    rating: number | null;
    review_count: number | null;
    monthly_purchases: number | null;
    last_updated: string;
    created_at: string;
    video_completed_at: string | null; // 영상 제작 완료 시간 (패널티 시스템용)
    brand: string | null;
    category: string;
    platform: 'coupang' | '11st';
}

export interface PriceHistoryDB {
    id: string;
    product_id: string;
    price: number;
    recorded_date: string;
    created_at: string;
}

export interface TrendHistoryDB {
    id: string;
    line_id: string;
    search_keyword: string;
    current_value: number;
    average_value: number;
    trend_direction: string;
    trend_slope: number;
    recorded_date: string;
    created_at: string;
}
