import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { normalizeProducts } from '@/lib/productNormalizer';

export async function POST(request: NextRequest) {
    // Rate limit: 3/min, 20/hour
    const rateLimitResponse = checkRateLimit(request, { maxPerMinute: 3, maxPerHour: 20 });
    if (rateLimitResponse) return rateLimitResponse;

    try {
        const body = await request.json();
        const { productNames, forceRefresh = false } = body;

        // Validation
        if (!Array.isArray(productNames) || productNames.length === 0) {
            return NextResponse.json({ error: '제품명 배열이 필요합니다.' }, { status: 400 });
        }
        if (productNames.length > 100) {
            return NextResponse.json({ error: '최대 100개까지 처리 가능합니다.' }, { status: 400 });
        }
        // Validate each item is a string, max 500 chars
        for (const name of productNames) {
            if (typeof name !== 'string' || name.length > 500) {
                return NextResponse.json({ error: '각 제품명은 500자 이하 문자열이어야 합니다.' }, { status: 400 });
            }
        }

        // Check env vars
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const geminiApiKey = process.env.GEMINI_API_KEY;

        console.log('[API /normalize] 환경변수 상태:', {
            supabaseUrl: !!supabaseUrl,
            serviceKey: !!serviceKey,
            geminiApiKey: !!geminiApiKey,
            productCount: productNames.length,
            forceRefresh,
        });

        if (!supabaseUrl || !serviceKey) {
            console.error('[API /normalize] Supabase 설정 누락');
            return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
        }
        if (!geminiApiKey) {
            console.error('[API /normalize] Gemini API 키 누락');
            return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
        }

        // Call normalizer
        console.log(`[API /normalize] 정규화 시작: ${productNames.length}개 제품`);
        const result = await normalizeProducts(productNames, supabaseUrl, serviceKey, geminiApiKey, forceRefresh);
        console.log(`[API /normalize] 정규화 완료: success=${result.success}, results=${result.results.length}, fromCache=${result.fromCache}, fromAI=${result.fromAI}, errors=${JSON.stringify(result.errors)}`);

        return NextResponse.json(result);
    } catch (error) {
        console.error('Normalize API error:', error);
        return NextResponse.json(
            { success: false, results: [], fromCache: 0, fromAI: 0, fromFallback: 0, errors: ['서버 오류가 발생했습니다.'] },
            { status: 500 }
        );
    }
}
