// API Route: Google Trends 데이터 조회
// POST /api/trends

import { NextRequest, NextResponse } from 'next/server';
import { TrendFetchRequest, TrendFetchResponse } from '@/lib/trendTypes';
import { fetchTrendData } from '@/lib/trendService';
import { checkRateLimit } from '@/lib/rateLimit';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;

const MAX_PRODUCT_LINES = 50;

export async function POST(request: NextRequest) {
    // Rate limiting
    const rateLimitResponse = checkRateLimit(request, { maxPerMinute: 3, maxPerHour: 20 });
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log('[API /trends] 환경변수 상태:', {
        supabaseUrl: !!supabaseUrl,
        supabaseAnonKey: !!supabaseAnonKey,
        serviceRoleKey: !!serviceRoleKey,
        hasToken: !!token,
    });

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
        console.error('[API /trends] 서버 설정 누락:', { supabaseUrl: !!supabaseUrl, supabaseAnonKey: !!supabaseAnonKey, serviceRoleKey: !!serviceRoleKey });
        return NextResponse.json(
            { success: false, results: [], fromCache: 0, fetched: 0, errors: ['Server config missing'] } satisfies TrendFetchResponse,
            { status: 500 }
        );
    }

    if (!token) {
        console.error('[API /trends] 인증 토큰 없음');
        return NextResponse.json(
            { success: false, results: [], fromCache: 0, fetched: 0, errors: ['Unauthorized'] } satisfies TrendFetchResponse,
            { status: 401 }
        );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
        console.error('[API /trends] 인증 실패:', authError?.message);
        return NextResponse.json(
            { success: false, results: [], fromCache: 0, fetched: 0, errors: ['Unauthorized'] } satisfies TrendFetchResponse,
            { status: 401 }
        );
    }

    console.log(`[API /trends] 인증 성공: ${user.email}`);

    try {
        const body = (await request.json()) as TrendFetchRequest;

        if (!body.productLines || body.productLines.length === 0) {
            return NextResponse.json(
                { success: false, results: [], fromCache: 0, fetched: 0, errors: ['No product lines provided'] } satisfies TrendFetchResponse,
                { status: 400 }
            );
        }

        if (body.productLines.length > MAX_PRODUCT_LINES) {
            return NextResponse.json(
                { success: false, results: [], fromCache: 0, fetched: 0, errors: [`Too many product lines (max ${MAX_PRODUCT_LINES})`] } satisfies TrendFetchResponse,
                { status: 400 }
            );
        }

        console.log(`[API /trends] 요청: productLines=${body.productLines.length}개, forceRefresh=${body.forceRefresh}`);

        const { results, fromCache, fetched, errors } = await fetchTrendData(
            body.productLines,
            supabaseUrl,
            serviceRoleKey,
            body.forceRefresh ?? false,
            body.category
        );

        console.log(`[API /trends] 결과: results=${results.length}, fromCache=${fromCache}, fetched=${fetched}, errors=${JSON.stringify(errors)}`);

        const response: TrendFetchResponse = {
            success: true,
            results,
            fromCache,
            fetched,
            errors,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('[API /trends] Error:', error);
        return NextResponse.json(
            { success: false, results: [], fromCache: 0, fetched: 0, errors: ['Internal server error'] } satisfies TrendFetchResponse,
            { status: 500 }
        );
    }
}
