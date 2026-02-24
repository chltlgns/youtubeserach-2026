// Product Scoring Algorithm
// 총점 = 구매수(25%) + 최저가 근접도(25%) + 리뷰 수(20%) + 트렌드(30%) - 영상 패널티(-25, 3일 decay) - 브랜드 패널티(-15, 2일 decay)

import { TrendScoreInput } from './trendTypes';

export interface ProductScoreInput {
    monthlyPurchases: number | null | undefined;
    reviewCount: number | null | undefined;
    currentPrice: number;
    lowestPrice: number;
    videoCompletedAt: string | null | undefined; // ISO date string - this product's video
    brand: string; // e.g., "LG전자", "삼성전자"
    brandVideoCompletedAt: string | null | undefined; // ISO date - most recent video of same brand (from other products)
    trendData: TrendScoreInput | null; // Google Trends 데이터
}

export interface ProductScoreResult {
    totalScore: number;
    purchaseScore: number;
    lowestPriceScore: number;
    reviewScore: number;
    trendScore: number;
    trendDirection: 'rising' | 'falling' | 'stable' | null;
    videoPenalty: number;
    brandPenalty: number;
    penaltyDaysRemaining: number | null;
    brandPenaltyDaysRemaining: number | null;
    grade: string;
    gradeColor: string;
}

// 가중치 상수
const WEIGHT_PURCHASE = 0.25;      // 25%
const WEIGHT_LOWEST_PRICE = 0.25;  // 25%
const WEIGHT_REVIEW = 0.20;        // 20%
// 트렌드 30%: 검색량 20% + 상승추세 10%

// 패널티 상수
const VIDEO_PENALTY_INITIAL = 25; // 영상 제작 시 초기 -25점
const VIDEO_PENALTY_DAYS = 3;     // 3일간 선형 감소
const BRAND_PENALTY_INITIAL = 15; // 브랜드 영상 제작 시 초기 -15점
const BRAND_PENALTY_DAYS = 2;     // 2일간 선형 감소

// 구매수 점수 계산 (상대적 순위 기반)
// allPurchases: 전체 제품의 구매수 배열
export function calculatePurchaseScore(
    purchases: number | null | undefined,
    allPurchases: number[]
): number {
    if (!purchases || purchases === 0) return 0;

    const validPurchases = allPurchases.filter(p => p > 0);
    if (validPurchases.length === 0) return 0;

    const maxPurchases = Math.max(...validPurchases);
    const minPurchases = Math.min(...validPurchases);

    if (maxPurchases === minPurchases) return 12.5; // 모두 같으면 중간점수 (25% 가중치의 절반)

    // 정규화: 0~100 범위로
    const normalized = ((purchases - minPurchases) / (maxPurchases - minPurchases)) * 100;
    return Math.round(normalized * WEIGHT_PURCHASE);
}

// 최저가 근접도 점수 계산
// 현재가가 역대 최저가에 가까울수록 높은 점수
export function calculateLowestPriceScore(
    currentPrice: number,
    lowestPrice: number
): number {
    if (!currentPrice || !lowestPrice || lowestPrice === 0) return 0;

    // 현재가 >= 최저가 (정상 케이스)
    // ratio = lowestPrice / currentPrice (0~1 사이, 1에 가까울수록 좋음)
    const ratio = lowestPrice / currentPrice;

    // ratio가 1이면 현재가 = 최저가 = 만점
    // ratio가 0.8이면 현재가가 최저가보다 20% 비싼 상태

    // 0.7 이하면 0점, 1.0이면 100점
    if (ratio <= 0.7) return 0;

    const normalized = ((ratio - 0.7) / 0.3) * 100;
    return Math.round(Math.min(normalized, 100) * WEIGHT_LOWEST_PRICE);
}

// 리뷰 수 점수 계산 (상대적 순위 기반)
export function calculateReviewScore(
    reviews: number | null | undefined,
    allReviews: number[]
): number {
    if (!reviews || reviews === 0) return 0;

    const validReviews = allReviews.filter(r => r > 0);
    if (validReviews.length === 0) return 0;

    const maxReviews = Math.max(...validReviews);
    const minReviews = Math.min(...validReviews);

    if (maxReviews === minReviews) return 10; // 모두 같으면 중간점수 (20% 가중치의 절반)

    const normalized = ((reviews - minReviews) / (maxReviews - minReviews)) * 100;
    return Math.round(normalized * WEIGHT_REVIEW);
}

// 트렌드 점수 계산
// 검색량 점수 (최대 20점) + 상승 보너스 (최대 10점)
export function calculateTrendScore(input: TrendScoreInput | null): number {
    if (!input) return 0;

    // 검색량 점수: currentValue(0-100)를 0-20점으로 변환
    const volumeScore = (input.currentValue / 100) * 20;

    // 상승 보너스
    let directionBonus = 0;
    if (input.trendDirection === 'rising') {
        // slope 크기에 비례하여 0~10점
        directionBonus = Math.min(Math.abs(input.trendSlope) / 2, 10);
    } else if (input.trendDirection === 'falling') {
        // 하락 시 최대 -5점
        directionBonus = -Math.min(Math.abs(input.trendSlope) / 4, 5);
    }

    return Math.round(Math.max(volumeScore + directionBonus, 0));
}

// 영상 제작 패널티 계산 (점진적 감소)
export function calculateVideoDecayPenalty(
    videoCompletedAt: string | null | undefined
): { penalty: number; daysRemaining: number | null } {
    if (!videoCompletedAt) {
        return { penalty: 0, daysRemaining: null };
    }

    const completedDate = new Date(videoCompletedAt);
    const now = new Date();
    const diffTime = now.getTime() - completedDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24); // 소수점 포함

    if (diffDays >= VIDEO_PENALTY_DAYS) {
        return { penalty: 0, daysRemaining: null };
    }

    const penalty = VIDEO_PENALTY_INITIAL * (1 - diffDays / VIDEO_PENALTY_DAYS);
    const daysRemaining = Math.ceil(VIDEO_PENALTY_DAYS - diffDays);

    return {
        penalty: Math.max(0, Math.round(penalty)),
        daysRemaining
    };
}

// 브랜드 패널티 계산 (점진적 감소)
export function calculateBrandDecayPenalty(
    brandVideoCompletedAt: string | null | undefined
): { penalty: number; daysRemaining: number | null } {
    if (!brandVideoCompletedAt) {
        return { penalty: 0, daysRemaining: null };
    }

    const completedDate = new Date(brandVideoCompletedAt);
    const now = new Date();
    const diffTime = now.getTime() - completedDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24); // 소수점 포함

    if (diffDays >= BRAND_PENALTY_DAYS) {
        return { penalty: 0, daysRemaining: null };
    }

    const penalty = BRAND_PENALTY_INITIAL * (1 - diffDays / BRAND_PENALTY_DAYS);
    const daysRemaining = Math.ceil(BRAND_PENALTY_DAYS - diffDays);

    return {
        penalty: Math.max(0, Math.round(penalty)),
        daysRemaining
    };
}

// 종합 점수 계산
export function calculateProductScore(
    input: ProductScoreInput,
    allPurchases: number[],
    allReviews: number[]
): ProductScoreResult {
    const purchaseScore = calculatePurchaseScore(input.monthlyPurchases, allPurchases);
    const lowestPriceScore = calculateLowestPriceScore(input.currentPrice, input.lowestPrice);
    const reviewScore = calculateReviewScore(input.reviewCount, allReviews);
    const trendScore = calculateTrendScore(input.trendData);

    const { penalty: videoPenalty, daysRemaining: penaltyDaysRemaining } =
        calculateVideoDecayPenalty(input.videoCompletedAt);
    const { penalty: brandPenalty, daysRemaining: brandPenaltyDaysRemaining } =
        calculateBrandDecayPenalty(input.brandVideoCompletedAt);

    const totalScore =
        purchaseScore +
        lowestPriceScore +
        reviewScore +
        trendScore -
        videoPenalty -
        brandPenalty;

    const { grade, color: gradeColor } = getScoreGrade(totalScore);

    return {
        totalScore: Math.max(totalScore, -80), // 최소 -80점
        purchaseScore,
        lowestPriceScore,
        reviewScore,
        trendScore,
        trendDirection: input.trendData?.trendDirection ?? null,
        videoPenalty,
        brandPenalty,
        penaltyDaysRemaining,
        brandPenaltyDaysRemaining,
        grade,
        gradeColor
    };
}

// 가격대 필터 (100만원 ~ 200만원)
export function isInTargetPriceRange(price: number): boolean {
    return price >= 1000000 && price <= 2000000;
}

// 점수 등급 표시
export function getScoreGrade(score: number): { grade: string; color: string } {
    if (score >= 80) return { grade: 'S', color: 'text-yellow-400' };
    if (score >= 60) return { grade: 'A', color: 'text-green-400' };
    if (score >= 40) return { grade: 'B', color: 'text-blue-400' };
    if (score >= 20) return { grade: 'C', color: 'text-gray-400' };
    return { grade: 'D', color: 'text-red-400' };
}
