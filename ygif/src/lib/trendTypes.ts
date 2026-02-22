// Google Trends 관련 공유 타입 정의

export interface ProductLine {
    lineId: string;           // "lg-gram-pro"
    displayName: string;      // "LG 그램 프로"
    searchKeyword: string;    // "LG 그램 프로"
    brand: string;            // "LG전자"
    category?: string;        // "노트북" | "데스크탑" | "태블릿" etc.
    generation?: string;      // "M4 Pro", "울트라7" etc.
}

export interface TrendResult {
    lineId: string;
    searchKeyword: string;
    currentValue: number;     // 0-100 (최근 검색량)
    averageValue: number;     // 기간 평균
    trendDirection: 'rising' | 'falling' | 'stable';
    trendSlope: number;       // 양수=상승, 음수=하락
    dataPoints: { date: string; value: number }[];
    fetchedAt: string;        // ISO timestamp
}

export interface RelatedQuery {
    query: string;
    value: number;        // 검색 관심도 (0-100)
    change: string;       // 변경율 ("+30%", "급등", "-5%")
}

export interface TrendScoreInput {
    currentValue: number;
    trendDirection: 'rising' | 'falling' | 'stable';
    trendSlope: number;
}

export interface TrendFetchRequest {
    productLines: ProductLine[];
    forceRefresh?: boolean;
}

export interface TrendFetchResponse {
    success: boolean;
    results: TrendResult[];
    fromCache: number;
    fetched: number;
    errors: string[];
}
