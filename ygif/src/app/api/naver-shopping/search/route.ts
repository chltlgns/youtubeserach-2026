import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { buildCompareResult, NaverShoppingApiResponse } from '@/lib/naverShoppingTypes';

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
const NAVER_SHOPPING_URL = 'https://openapi.naver.com/v1/search/shop.json';

const ALLOWED_SORTS = ['sim', 'date', 'asc', 'dsc'] as const;

export async function GET(request: NextRequest) {
    // Rate limiting: max 10 requests per minute per IP
    const rateLimitResponse = checkRateLimit(request, { maxPerMinute: 10, maxPerHour: 100 });
    if (rateLimitResponse) return rateLimitResponse;

    if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
        return NextResponse.json(
            { error: 'Naver API keys not configured' },
            { status: 500 }
        );
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q || q.trim() === '') {
        return NextResponse.json(
            { error: 'Query parameter "q" is required' },
            { status: 400 }
        );
    }

    const displayRaw = parseInt(searchParams.get('display') || '100', 10);
    const display = Math.min(Math.max(1, isNaN(displayRaw) ? 100 : displayRaw), 100);

    const sortParam = searchParams.get('sort') || 'sim';
    const sort = ALLOWED_SORTS.includes(sortParam as typeof ALLOWED_SORTS[number])
        ? sortParam
        : 'sim';

    const params = new URLSearchParams({
        query: q.trim(),
        display: display.toString(),
        sort,
    });

    try {
        const response = await fetch(`${NAVER_SHOPPING_URL}?${params}`, {
            headers: {
                'X-Naver-Client-Id': NAVER_CLIENT_ID,
                'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
            },
        });

        if (response.status === 429) {
            return NextResponse.json(
                { error: 'Naver API rate limit exceeded. Please try again later.' },
                { status: 429 }
            );
        }

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error(`[Naver Shopping] API error ${response.status}:`, errorText);
            return NextResponse.json(
                { error: `Naver API returned status ${response.status}` },
                { status: 502 }
            );
        }

        const data: NaverShoppingApiResponse = await response.json();
        const result = buildCompareResult(q.trim(), data);

        return NextResponse.json(result);
    } catch (error) {
        console.error('[Naver Shopping] Fetch error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch from Naver Shopping API' },
            { status: 500 }
        );
    }
}
