// Google Trends Service
// 제품 라인별 트렌드 데이터 조회 + Supabase 캐싱

import { createClient } from '@supabase/supabase-js';
import { ProductLine, TrendResult, RelatedQuery } from './trendTypes';

const CACHE_TTL_DAYS = 7;
const BATCH_SIZE = 4; // 실제 키워드 슬롯 (앵커 키워드 1개 제외)
const BATCH_DELAY_MS = 5000;
const CATEGORY_ANCHORS: Record<string, string> = {
    '노트북': '노트북',
    '데스크탑': '데스크탑',
    '태블릿': '태블릿',
    '모니터': '모니터',
    '키보드': '키보드',
    '마우스': '마우스',
};

function getAnchorKeyword(category?: string): string {
    if (!category) return '노트북';
    return CATEGORY_ANCHORS[category] || '노트북';
}

const RETRY_DELAY_MS = 5000;
const MAX_RETRIES = 2;

/**
 * Supabase에서 캐시된 트렌드 데이터 조회
 */
async function getCachedTrends(
    supabaseUrl: string,
    serviceRoleKey: string,
    lineIds: string[]
): Promise<TrendResult[]> {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - CACHE_TTL_DAYS);

    const { data, error } = await supabase
        .from('trend_cache')
        .select('*')
        .in('line_id', lineIds)
        .gte('fetched_at', cutoff.toISOString());

    if (error || !data) return [];

    return data.map((row: Record<string, unknown>) => ({
        lineId: row.line_id as string,
        searchKeyword: row.search_keyword as string,
        currentValue: row.current_value as number,
        averageValue: row.average_value as number,
        trendDirection: row.trend_direction as 'rising' | 'falling' | 'stable',
        trendSlope: row.trend_slope as number,
        dataPoints: row.data_points as { date: string; value: number }[],
        fetchedAt: row.fetched_at as string,
    }));
}

/**
 * 캐시에 트렌드 데이터 저장 (upsert)
 */
async function saveTrendCache(
    supabaseUrl: string,
    serviceRoleKey: string,
    result: TrendResult
): Promise<void> {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    await supabase
        .from('trend_cache')
        .upsert({
            line_id: result.lineId,
            search_keyword: result.searchKeyword,
            current_value: result.currentValue,
            average_value: result.averageValue,
            trend_direction: result.trendDirection,
            trend_slope: result.trendSlope,
            data_points: result.dataPoints,
            fetched_at: result.fetchedAt,
        }, { onConflict: 'line_id' });
}

/**
 * 트렌드 히스토리 저장 (일별 기록)
 */
async function saveTrendHistory(
    supabaseUrl: string,
    serviceRoleKey: string,
    result: TrendResult
): Promise<void> {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const today = new Date().toISOString().split('T')[0];

    await supabase
        .from('trend_history')
        .upsert({
            line_id: result.lineId,
            search_keyword: result.searchKeyword,
            current_value: result.currentValue,
            average_value: result.averageValue,
            trend_direction: result.trendDirection,
            trend_slope: result.trendSlope,
            recorded_date: today,
        }, { onConflict: 'line_id,recorded_date' });
}

/**
 * 데이터 포인트에서 트렌드 방향 계산 (최근 4포인트 선형 회귀)
 */
function calculateTrendDirection(dataPoints: { date: string; value: number }[]): {
    direction: 'rising' | 'falling' | 'stable';
    slope: number;
} {
    if (dataPoints.length < 2) {
        return { direction: 'stable', slope: 0 };
    }

    // 최근 4개 포인트
    const recent = dataPoints.slice(-4);
    const n = recent.length;

    // 단순 선형 회귀: y = a + bx
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += recent[i].value;
        sumXY += i * recent[i].value;
        sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    if (slope > 5) return { direction: 'rising', slope };
    if (slope < -5) return { direction: 'falling', slope };
    return { direction: 'stable', slope };
}

/**
 * google-trends-api로 배치 조회
 * 앵커 키워드("노트북")를 포함하여 배치 간 정규화
 */
async function fetchTrendBatch(
    keywords: string[],
    googleTrends: { interestOverTime: (opts: Record<string, unknown>) => Promise<string> },
    retryCount: number = 0,
    category?: string
): Promise<Map<string, { dataPoints: { date: string; value: number }[] }>> {
    const allKeywords = [getAnchorKeyword(category), ...keywords];
    const result = new Map<string, { dataPoints: { date: string; value: number }[] }>();

    try {
        const response = await googleTrends.interestOverTime({
            keyword: allKeywords,
            startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30일 전
            geo: 'KR',
            hl: 'ko',
            // NOTE: interestOverTime은 YouTube 기준 유지 (기존 trend_cache 값 스케일 호환)
            // relatedQueries만 웹 검색으로 변경됨
            property: 'youtube',
        });

        const parsed = JSON.parse(response);
        const timelineData = parsed?.default?.timelineData;

        if (!timelineData || !Array.isArray(timelineData)) {
            return result;
        }

        // 앵커 키워드의 평균값 계산 (정규화용)
        let anchorSum = 0;
        let anchorCount = 0;
        for (const point of timelineData) {
            const anchorValue = point.value?.[0] ?? 0;
            if (anchorValue > 0) {
                anchorSum += anchorValue;
                anchorCount++;
            }
        }
        const anchorAvg = anchorCount > 0 ? anchorSum / anchorCount : 1;

        // 각 키워드별 데이터 추출
        for (let ki = 0; ki < keywords.length; ki++) {
            const dataPoints: { date: string; value: number }[] = [];
            for (const point of timelineData) {
                const rawValue = point.value?.[ki + 1] ?? 0; // +1 because anchor is index 0
                // 앵커 대비 정규화: 앵커 평균을 50으로 맞추고 비례
                const normalized = anchorAvg > 0 ? Math.round((rawValue / anchorAvg) * 50) : rawValue;
                dataPoints.push({
                    date: point.formattedAxisTime || new Date(point.time * 1000).toISOString().split('T')[0],
                    value: Math.min(normalized, 100),
                });
            }
            result.set(keywords[ki], { dataPoints });
        }
    } catch (error) {
        console.error('[TrendService] Batch fetch error:', error);
        // 429 에러 시 재시도 (최대 MAX_RETRIES회)
        if (error instanceof Error && error.message.includes('429') && retryCount < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
            try {
                return await fetchTrendBatch(keywords, googleTrends, retryCount + 1, category);
            } catch {
                // 재시도도 실패하면 빈 결과 반환
            }
        }
    }

    return result;
}

/**
 * 제품 라인 목록에 대한 트렌드 데이터 조회 (메인 함수)
 * API route에서 호출됨
 */
export async function fetchTrendData(
    productLines: ProductLine[],
    supabaseUrl: string,
    serviceRoleKey: string,
    forceRefresh: boolean = false,
    category?: string
): Promise<{
    results: TrendResult[];
    fromCache: number;
    fetched: number;
    errors: string[];
}> {
    const results: TrendResult[] = [];
    const errors: string[] = [];
    let fromCache = 0;
    let fetched = 0;

    // 1. 캐시 확인 (forceRefresh가 아닌 경우)
    let uncachedLines = productLines;
    if (!forceRefresh) {
        const lineIds = productLines.map(l => l.lineId);
        const cached = await getCachedTrends(supabaseUrl, serviceRoleKey, lineIds);
        const cachedIds = new Set(cached.map(c => c.lineId));

        results.push(...cached);
        fromCache = cached.length;
        uncachedLines = productLines.filter(l => !cachedIds.has(l.lineId));
    }

    if (uncachedLines.length === 0) {
        return { results, fromCache, fetched, errors };
    }

    // 2. google-trends-api 동적 import (서버사이드 전용)
    let googleTrends: { interestOverTime: (opts: Record<string, unknown>) => Promise<string> };
    try {
        googleTrends = await import('google-trends-api') as unknown as typeof googleTrends;
    } catch (err) {
        errors.push(`Failed to load google-trends-api: ${err}`);
        return { results, fromCache, fetched, errors };
    }

    // 3. 배치 분할 후 순차 처리
    for (let i = 0; i < uncachedLines.length; i += BATCH_SIZE) {
        const batch = uncachedLines.slice(i, i + BATCH_SIZE);
        const keywords = batch.map(l => l.searchKeyword);

        if (i > 0) {
            await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
        }

        const batchResults = await fetchTrendBatch(keywords, googleTrends, 0, category);

        for (const line of batch) {
            const data = batchResults.get(line.searchKeyword);
            if (!data || data.dataPoints.length === 0) {
                errors.push(`No data for: ${line.searchKeyword}`);
                // 데이터 없는 경우 기본값으로 결과 생성
                const emptyResult: TrendResult = {
                    lineId: line.lineId,
                    searchKeyword: line.searchKeyword,
                    currentValue: 0,
                    averageValue: 0,
                    trendDirection: 'stable',
                    trendSlope: 0,
                    dataPoints: [],
                    fetchedAt: new Date().toISOString(),
                };
                results.push(emptyResult);
                continue;
            }

            const { direction, slope } = calculateTrendDirection(data.dataPoints);
            const currentValue = data.dataPoints[data.dataPoints.length - 1]?.value ?? 0;
            const avgValue = data.dataPoints.length > 0
                ? Math.round(data.dataPoints.reduce((s, d) => s + d.value, 0) / data.dataPoints.length)
                : 0;

            const trendResult: TrendResult = {
                lineId: line.lineId,
                searchKeyword: line.searchKeyword,
                currentValue,
                averageValue: avgValue,
                trendDirection: direction,
                trendSlope: Math.round(slope * 100) / 100,
                dataPoints: data.dataPoints,
                fetchedAt: new Date().toISOString(),
            };

            results.push(trendResult);
            fetched++;

            // 캐시 저장
            await saveTrendCache(supabaseUrl, serviceRoleKey, trendResult).catch(err => {
                errors.push(`Cache save failed for ${line.lineId}: ${err}`);
            });
            // 히스토리 저장
            await saveTrendHistory(supabaseUrl, serviceRoleKey, trendResult).catch(err => {
                errors.push(`History save failed for ${line.lineId}: ${err}`);
            });
        }
    }

    return { results, fromCache, fetched, errors };
}

/**
 * 특정 키워드의 관련검색어 조회 (상위 + 급상승)
 */
export async function fetchRelatedQueries(
    searchKeyword: string
): Promise<{ top: RelatedQuery[]; rising: RelatedQuery[] }> {
    const empty = { top: [], rising: [] };

    let googleTrends: { relatedQueries: (opts: Record<string, unknown>) => Promise<string> };
    try {
        googleTrends = await import('google-trends-api') as unknown as typeof googleTrends;
    } catch {
        console.error('[TrendService] Failed to load google-trends-api for related queries');
        return empty;
    }

    try {
        const response = await googleTrends.relatedQueries({
            keyword: searchKeyword,
            startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            geo: 'KR',
            hl: 'ko',
            property: '',
        });

        const parsed = JSON.parse(response);
        const data = parsed?.default;

        if (!data) return empty;

        const rankedList = data.rankedList;
        if (!rankedList || !Array.isArray(rankedList)) return empty;

        const topRaw = rankedList[0]?.rankedKeyword || [];
        const risingRaw = rankedList[1]?.rankedKeyword || [];

        const top: RelatedQuery[] = topRaw.slice(0, 10).map((item: { query: string; value: number }) => ({
            query: item.query,
            value: item.value,
            change: '',
        }));

        const rising: RelatedQuery[] = risingRaw.slice(0, 10).map((item: { query: string; value?: number; formattedValue?: string }) => ({
            query: item.query,
            value: item.value ?? 0,
            change: item.formattedValue || '급등',
        }));

        return { top, rising };
    } catch (error) {
        console.error('[TrendService] Related queries error:', error);
        if (error instanceof Error && error.message.includes('429')) {
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
            try {
                const retryResponse = await googleTrends.relatedQueries({
                    keyword: searchKeyword,
                    startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    geo: 'KR',
                    hl: 'ko',
                    property: '',
                });
                const retryParsed = JSON.parse(retryResponse);
                const retryData = retryParsed?.default;
                if (!retryData) return empty;

                const retryRankedList = retryData.rankedList;
                if (!retryRankedList || !Array.isArray(retryRankedList)) return empty;

                const topRaw = retryRankedList[0]?.rankedKeyword || [];
                const risingRaw = retryRankedList[1]?.rankedKeyword || [];

                return {
                    top: topRaw.slice(0, 10).map((item: { query: string; value: number }) => ({
                        query: item.query, value: item.value, change: '',
                    })),
                    rising: risingRaw.slice(0, 10).map((item: { query: string; value?: number; formattedValue?: string }) => ({
                        query: item.query, value: item.value ?? 0, change: item.formattedValue || '급등',
                    })),
                };
            } catch {
                return empty;
            }
        }
        return empty;
    }
}
