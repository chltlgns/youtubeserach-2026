import { NextRequest, NextResponse } from 'next/server';

interface RateLimitEntry {
    timestamps: number[];
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Clean up old entries every 10 minutes
const CLEANUP_INTERVAL = 10 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupOldEntries() {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL) return;
    lastCleanup = now;

    const oneHourAgo = now - 60 * 60 * 1000;
    for (const [key, entry] of rateLimitMap) {
        entry.timestamps = entry.timestamps.filter(t => t > oneHourAgo);
        if (entry.timestamps.length === 0) {
            rateLimitMap.delete(key);
        }
    }
}

function getClientIp(request: NextRequest): string {
    return (
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'unknown'
    );
}

interface RateLimitOptions {
    maxPerMinute?: number;
    maxPerHour?: number;
}

/**
 * Check rate limit for a request. Returns null if allowed, or a NextResponse if rate limited.
 */
export function checkRateLimit(
    request: NextRequest,
    options: RateLimitOptions = {}
): NextResponse | null {
    const { maxPerMinute = 10, maxPerHour = 100 } = options;

    cleanupOldEntries();

    const ip = getClientIp(request);
    const now = Date.now();

    let entry = rateLimitMap.get(ip);
    if (!entry) {
        entry = { timestamps: [] };
        rateLimitMap.set(ip, entry);
    }

    // Clean timestamps older than 1 hour
    const oneHourAgo = now - 60 * 60 * 1000;
    entry.timestamps = entry.timestamps.filter(t => t > oneHourAgo);

    // Check per-hour limit
    if (entry.timestamps.length >= maxPerHour) {
        return NextResponse.json(
            { error: '요청 한도를 초과했습니다. 1시간 후에 다시 시도해주세요.' },
            { status: 429 }
        );
    }

    // Check per-minute limit
    const oneMinuteAgo = now - 60 * 1000;
    const recentCount = entry.timestamps.filter(t => t > oneMinuteAgo).length;
    if (recentCount >= maxPerMinute) {
        return NextResponse.json(
            { error: '요청이 너무 빠릅니다. 1분 후에 다시 시도해주세요.' },
            { status: 429 }
        );
    }

    // Record this request
    entry.timestamps.push(now);
    return null;
}
