// Coupang Price Tracker Types

export interface CoupangProduct {
    id: string;                    // Unique ID (timestamp-based)
    url: string;                   // Product URL
    productName: string;           // 제품명
    currentPrice: number;          // 현재 가격 (할인된 가격)
    originalPrice: number;         // 원래 가격
    discountRate: string;          // 할인율 (예: "9%")
    previousPrice?: number;        // 전일 가격
    priceChangeRate?: string;      // 전일대비 변동율 (예: "-5%", "+3%")
    rating?: number | null;        // 별점
    reviewCount?: number | null;   // 리뷰 수
    monthlyPurchases?: number | null; // 월간 구매수
    lastUpdated: string;           // 마지막 업데이트 (ISO string)
    dateAdded?: string;            // 추가된 날짜 (ISO string)
    videoCompletedAt?: string | null; // 영상 생성 완료일
    brand?: string;                // 브랜드 (자동 분류)
}

export interface CoupangState {
    products: CoupangProduct[];
    lastResetDate: string;         // 마지막 리셋 날짜 (YYYY-MM-DD)
}

// Data from bookmarklet (JSON format)
export interface CoupangScrapedData {
    url: string;
    productName: string;
    currentPrice: number;
    originalPrice: number;
    discountRate: string;
}

// localStorage key
export const COUPANG_STORAGE_KEY = 'ygif_coupang_data';

// Reset time (9:00 AM KST)
export const RESET_HOUR = 9;

// === Auto Register Types ===

export interface ScrapedNotebook {
    url: string;
    productName: string;
    currentPrice: number;
    originalPrice: number;
    discountRate: string;
    rating: number | null;
    reviewCount: number | null;
    monthlyPurchases: number | null;
    brand: string;
    thumbnailUrl: string | null;
}

export interface AutoRegisterRequest {
    brands: string[];
    batchSize: number;
    minPrice?: number;
    maxPrice?: number;
    sortBy?: string;
}

export interface AutoRegisterBrandResult {
    brand: string;
    registered: ScrapedNotebook[];
    skipped: string[];
    errors: string[];
}

export interface AutoRegisterResponse {
    success: boolean;
    registered: number;
    skipped: number;
    failed: number;
    details: AutoRegisterBrandResult[];
}

export interface AutoRegisterProgress {
    type: 'progress' | 'brand_start' | 'brand_complete' | 'result' | 'error';
    brand?: string;
    current?: number;
    total?: number;
    message: string;
    data?: AutoRegisterResponse;
}