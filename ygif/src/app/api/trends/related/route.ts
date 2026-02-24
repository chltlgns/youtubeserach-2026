// API Route: Google Trends 관련검색어 조회
// POST /api/trends/related

import { NextRequest, NextResponse } from 'next/server';
import { fetchRelatedQueries } from '@/lib/trendService';
import { checkRateLimit } from '@/lib/rateLimit';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
    // Rate limiting
    const rateLimitResponse = checkRateLimit(request, { maxPerMinute: 5, maxPerHour: 30 });
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        return NextResponse.json(
            { success: false, error: 'Server config missing' },
            { status: 500 }
        );
    }

    if (!token) {
        return NextResponse.json(
            { success: false, error: 'Unauthorized' },
            { status: 401 }
        );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
        return NextResponse.json(
            { success: false, error: 'Unauthorized' },
            { status: 401 }
        );
    }

    try {
        const body = await request.json();
        const { searchKeyword } = body;

        if (!searchKeyword || typeof searchKeyword !== 'string') {
            return NextResponse.json(
                { success: false, error: 'searchKeyword is required' },
                { status: 400 }
            );
        }

        const result = await fetchRelatedQueries(searchKeyword);

        return NextResponse.json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error('[API /trends/related] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
