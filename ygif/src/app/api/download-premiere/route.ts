import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { checkRateLimit } from '@/lib/rateLimit';

export interface DownloadPremiereRequest {
    url: string;
}

export interface DownloadPremiereResponse {
    success: boolean;
    filename?: string;
    format?: string;
    size?: string;
    error?: string;
    download_url?: string;
}

export async function POST(request: NextRequest) {
    // Rate limiting
    const rateLimitResponse = checkRateLimit(request, { maxPerMinute: 3, maxPerHour: 20 });
    if (rateLimitResponse) return rateLimitResponse;

    const YTDLP_BACKEND_URL = process.env.YTDLP_BACKEND_URL;
    if (!YTDLP_BACKEND_URL) {
        return NextResponse.json(
            { success: false, error: 'yt-dlp 백엔드 URL이 설정되지 않았습니다. YTDLP_BACKEND_URL 환경변수를 확인해주세요.' },
            { status: 503 }
        );
    }

    try {
        const { url } = await request.json();

        if (!url || typeof url !== 'string') {
            return NextResponse.json(
                { success: false, error: 'URL is required' },
                { status: 400 }
            );
        }

        // Validate YouTube URL
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/;
        if (!youtubeRegex.test(url)) {
            return NextResponse.json(
                { success: false, error: 'Invalid YouTube URL' },
                { status: 400 }
            );
        }

        try {
            // Call Python FastAPI backend for premiere-ready download
            const response = await axios.post(`${YTDLP_BACKEND_URL}/download-premiere`, {
                url,
            }, {
                timeout: 600000, // 10 minutes timeout (encoding takes longer)
            });

            return NextResponse.json(response.data);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNREFUSED') {
                    return NextResponse.json(
                        { success: false, error: 'yt-dlp 백엔드 서버가 실행 중이 아닙니다. Python 서버를 시작해주세요.' },
                        { status: 503 }
                    );
                }
                return NextResponse.json(
                    { success: false, error: error.response?.data?.error || error.response?.data?.detail || 'Download failed' },
                    { status: error.response?.status || 500 }
                );
            }
            throw error;
        }
    } catch (error) {
        console.error('Download Premiere API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to process download request' },
            { status: 500 }
        );
    }
}
