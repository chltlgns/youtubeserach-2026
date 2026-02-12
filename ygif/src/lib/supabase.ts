import { createClient } from '@supabase/supabase-js';

// SSR-safe: polyfill sessionStorage for server-side rendering
if (typeof globalThis.sessionStorage === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).sessionStorage = {
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
        // Custom storage that safely handles SSR (sessionStorage not available on server)
        storage: typeof window !== 'undefined' ? sessionStorage : {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        },
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
}

export interface PriceHistoryDB {
    id: string;
    product_id: string;
    price: number;
    recorded_date: string;
    created_at: string;
}

