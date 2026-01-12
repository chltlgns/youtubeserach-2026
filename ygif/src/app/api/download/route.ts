import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const YTDLP_BACKEND_URL = process.env.YTDLP_BACKEND_URL || 'http://localhost:8000';

export interface DownloadRequest {
    url: string;
    format?: string;
}

export interface DownloadResponse {
    success: boolean;
    filename?: string;
    format?: string;
    size?: string;
    error?: string;
    download_url?: string;
}

export async function POST(request: NextRequest) {
    try {
        const { url, format = 'best' } = await request.json();

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
            // Call Python FastAPI backend for yt-dlp download
            const response = await axios.post(`${YTDLP_BACKEND_URL}/download`, {
                url,
                format,
            }, {
                timeout: 300000, // 5 minutes timeout
            });

            return NextResponse.json(response.data);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNREFUSED') {
                    return NextResponse.json(
                        { success: false, error: 'yt-dlp backend server is not running. Please start the Python server.' },
                        { status: 503 }
                    );
                }
                return NextResponse.json(
                    { success: false, error: error.response?.data?.error || 'Download failed' },
                    { status: error.response?.status || 500 }
                );
            }
            throw error;
        }
    } catch (error) {
        console.error('Download API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to process download request' },
            { status: 500 }
        );
    }
}

// Get download status or list
export async function GET(request: NextRequest) {
    try {
        const response = await axios.get(`${YTDLP_BACKEND_URL}/downloads`);
        return NextResponse.json(response.data);
    } catch (error) {
        if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
            return NextResponse.json(
                { success: false, error: 'yt-dlp backend server is not running' },
                { status: 503 }
            );
        }
        return NextResponse.json(
            { success: false, error: 'Failed to get downloads' },
            { status: 500 }
        );
    }
}
