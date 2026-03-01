// Naver Shopping Search API Types

// === API Request/Response ===

export interface NaverShoppingSearchParams {
    query: string;          // 검색어
    display?: number;       // 결과 수 (1-100, default 10)
    start?: number;         // 시작 위치 (1-1000, default 1)
    sort?: 'sim' | 'date' | 'asc' | 'dsc'; // 정렬: 유사도/날짜/가격오름/가격내림
}

export interface NaverShoppingItem {
    title: string;          // 상품명 (HTML 태그 포함 가능)
    link: string;           // 상품 URL
    image: string;          // 썸네일 이미지 URL
    lprice: string;         // 최저가 (문자열)
    hprice: string;         // 최고가 (문자열, 빈 문자열일 수 있음)
    mallName: string;       // 쇼핑몰명 (쿠팡, 11번가, G마켓 등)
    productId: string;      // 네이버 상품 ID
    productType: string;    // 상품 타입 (1: 일반, 2: 가격비교, 3: 해외)
    brand: string;          // 브랜드명
    maker: string;          // 제조사
    category1: string;      // 대분류
    category2: string;      // 중분류
    category3: string;      // 소분류
    category4: string;      // 세분류
}

export interface NaverShoppingApiResponse {
    lastBuildDate: string;  // 검색 결과 생성 시각
    total: number;          // 총 검색 결과 수
    start: number;          // 시작 위치
    display: number;        // 표시 결과 수
    items: NaverShoppingItem[];
}

// === Frontend Types ===

export type PlatformFilter = 'all' | 'coupang' | '11st' | 'other';

export interface PriceCompareItem {
    title: string;          // HTML 태그 제거된 상품명
    link: string;           // 상품 URL
    image: string;          // 썸네일
    price: number;          // 최저가 (숫자)
    highPrice: number | null; // 최고가 (숫자, null 가능)
    mallName: string;       // 쇼핑몰명
    platform: PlatformFilter; // 분류된 플랫폼
    brand: string;          // 브랜드
    category: string;       // 카테고리 (category1 > category2)
    productId: string;      // 네이버 상품 ID
}

export interface PriceCompareResult {
    query: string;          // 검색어
    total: number;          // 총 결과 수
    items: PriceCompareItem[];
    coupangItems: PriceCompareItem[];    // 쿠팡 결과만
    elevenStItems: PriceCompareItem[];   // 11번가 결과만
    otherItems: PriceCompareItem[];      // 기타 쇼핑몰
    lowestPrice: PriceCompareItem | null; // 전체 최저가 상품
    coupangLowest: PriceCompareItem | null;  // 쿠팡 최저가
    elevenStLowest: PriceCompareItem | null; // 11번가 최저가
}

// === Utility Functions ===

/** mallName을 플랫폼으로 분류 */
export function classifyPlatform(mallName: string): PlatformFilter {
    const name = mallName.toLowerCase();
    if (name.includes('쿠팡') || name.includes('coupang')) return 'coupang';
    if (name.includes('11번가') || name.includes('11st')) return '11st';
    return 'other';
}

/** HTML 태그 제거 (네이버 API는 <b> 태그를 포함할 수 있음) */
export function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
}

/** NaverShoppingItem을 PriceCompareItem으로 변환 */
export function toCompareItem(item: NaverShoppingItem): PriceCompareItem {
    return {
        title: stripHtml(item.title),
        link: item.link,
        image: item.image,
        price: parseInt(item.lprice, 10) || 0,
        highPrice: item.hprice ? parseInt(item.hprice, 10) || null : null,
        mallName: item.mallName,
        platform: classifyPlatform(item.mallName),
        brand: item.brand,
        category: [item.category1, item.category2].filter(Boolean).join(' > '),
        productId: item.productId,
    };
}

/** 검색 결과를 PriceCompareResult로 가공 */
export function buildCompareResult(query: string, response: NaverShoppingApiResponse): PriceCompareResult {
    const items = response.items.map(toCompareItem);
    const coupangItems = items.filter(i => i.platform === 'coupang').sort((a, b) => a.price - b.price);
    const elevenStItems = items.filter(i => i.platform === '11st').sort((a, b) => a.price - b.price);
    const otherItems = items.filter(i => i.platform === 'other').sort((a, b) => a.price - b.price);

    const allSorted = [...items].sort((a, b) => a.price - b.price);

    return {
        query,
        total: response.total,
        items: allSorted,
        coupangItems,
        elevenStItems,
        otherItems,
        lowestPrice: allSorted[0] || null,
        coupangLowest: coupangItems[0] || null,
        elevenStLowest: elevenStItems[0] || null,
    };
}
