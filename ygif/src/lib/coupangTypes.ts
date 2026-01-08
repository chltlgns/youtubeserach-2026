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
    lastUpdated: string;           // 마지막 업데이트 (ISO string)
    dateAdded: string;             // 추가된 날짜 (ISO string)
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
