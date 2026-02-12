import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getBrandById } from '@/lib/coupangBrands';

// Env var validation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Per-brand scraping timeout (3 minutes)
const SCRAPE_TIMEOUT_MS = 3 * 60 * 1000;
// Overall request timeout - configurable via env, default 55s for Vercel compatibility
const TOTAL_TIMEOUT_MS = parseInt(process.env.AUTO_REGISTER_TIMEOUT_MS || '55000', 10);

interface AutoRegisterRequest {
    brands: string[];
    batchSize: number;
    minPrice?: number;
    maxPrice?: number;
    sortBy?: string;
    scrapeMultiplier?: number; // How many times batchSize to scrape (default: 3)
}

// Normalize URL for comparison: strip www, trailing slash, all query params
function normalizeUrl(url: string): string {
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.replace(/^www\./, '');
        const pathname = parsed.pathname.replace(/\/$/, '');
        return `${hostname}${pathname}`;
    } catch {
        // Fallback: strip query params and trailing slash from raw string
        return url.split('?')[0].replace(/\/$/, '');
    }
}

function isBrowserClosedError(err: unknown): boolean {
    const msg = String(err);
    return msg.includes('Target page, context or browser has been closed')
        || msg.includes('browser has been closed')
        || msg.includes('Protocol error')
        || msg.includes('Session closed')
        || msg.includes('Navigation failed because page was closed');
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error(`Timeout: ${label} exceeded ${ms / 1000}s`)),
            ms,
        );
        promise.then(
            (val) => { clearTimeout(timer); resolve(val); },
            (err) => { clearTimeout(timer); reject(err); },
        );
    });
}

export async function POST(request: NextRequest) {
    // Check if scraper is enabled
    if (process.env.ENABLE_SCRAPER !== 'true') {
        return new Response(
            JSON.stringify({ error: '이 기능은 로컬 환경에서만 사용 가능합니다. ENABLE_SCRAPER=true 환경변수를 설정해주세요.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // Validate Supabase env vars
    if (!supabaseUrl) {
        return new Response(
            JSON.stringify({ error: 'NEXT_PUBLIC_SUPABASE_URL 환경변수가 설정되지 않았습니다.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
    }
    if (!supabaseServiceKey) {
        return new Response(
            JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // Dynamic import to prevent bundling playwright on Vercel
    let scrapeNotebooks: typeof import('@/lib/coupangPlaywright').scrapeNotebooks;
    try {
        const mod = await import('@/lib/coupangPlaywright');
        scrapeNotebooks = mod.scrapeNotebooks;
    } catch {
        return new Response(
            JSON.stringify({ error: 'Playwright를 로드할 수 없습니다. 로컬 환경에서 설치해주세요.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
    }

    const encoder = new TextEncoder();
    const abortController = new AbortController();

    let writerClosed = false;

    const stream = new ReadableStream({
        start(controller) {
            const sendEvent = (data: Record<string, unknown>) => {
                if (writerClosed) return;
                try {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                } catch {
                    writerClosed = true;
                }
            };

            const closeStream = () => {
                if (writerClosed) return;
                writerClosed = true;
                try {
                    controller.close();
                } catch {
                    // already closed
                }
            };

            // Set overall timeout
            const totalTimer = setTimeout(() => {
                sendEvent({
                    type: 'error',
                    message: `전체 작업 시간 초과 (${Math.round(TOTAL_TIMEOUT_MS / 1000)}초). 처리된 결과까지만 반영됩니다.`,
                });
                abortController.abort();
                closeStream();
            }, TOTAL_TIMEOUT_MS);

            // Main processing
            (async () => {
                try {
                    const body: AutoRegisterRequest = await request.json();
                    const { brands, batchSize, minPrice, maxPrice, sortBy, scrapeMultiplier } = body;
                    const multiplier = Math.min(Math.max(scrapeMultiplier || 3, 1), 5); // clamp 1-5, default 3

                    // Auth: get user from authorization header
                    const authHeader = request.headers.get('authorization');
                    const token = authHeader?.replace('Bearer ', '');

                    const supabase = createClient(supabaseUrl, supabaseServiceKey);

                    let userId: string | null = null;
                    if (token) {
                        const { data: { user } } = await supabase.auth.getUser(token);
                        userId = user?.id || null;
                    }

                    if (!userId) {
                        sendEvent({ type: 'error', message: '인증이 필요합니다.' });
                        return;
                    }

                    // Get existing product URLs for this user
                    const { data: existingProducts } = await supabase
                        .from('products')
                        .select('url')
                        .eq('user_id', userId);

                    const existingUrls = new Set(
                        (existingProducts || []).map((p: { url: string }) => normalizeUrl(p.url))
                    );

                    sendEvent({
                        type: 'progress',
                        message: `기존 등록 제품 ${existingUrls.size}개 확인 완료`,
                        current: 0,
                        total: brands.length,
                    });

                    let totalRegistered = 0;
                    let totalSkipped = 0;
                    let totalFailed = 0;
                    const details: Array<{
                        brand: string;
                        registered: Array<{ url: string; productName: string; currentPrice: number }>;
                        skipped: string[];
                        errors: string[];
                    }> = [];

                    for (let i = 0; i < brands.length; i++) {
                        // Check if aborted (total timeout or client disconnect)
                        if (abortController.signal.aborted) {
                            sendEvent({
                                type: 'error',
                                message: '작업이 중단되었습니다.',
                            });
                            break;
                        }

                        const brandId = brands[i];
                        const brand = getBrandById(brandId);

                        if (!brand) {
                            sendEvent({
                                type: 'error',
                                brand: brandId,
                                message: `알 수 없는 브랜드: ${brandId}`,
                            });
                            totalFailed++;
                            continue;
                        }

                        const searchQuery = `${brand.coupangBrandParam} (${brand.englishName})`;
                        const brandStartTime = Date.now();

                        sendEvent({
                            type: 'brand_start',
                            brand: brand.koreanName,
                            message: `${brand.koreanName} 노트북 스크래핑 시작...`,
                            searchQuery,
                            current: i + 1,
                            total: brands.length,
                        });

                        try {
                            // Scrape notebooks for this brand with per-brand timeout
                            const scraped = await withTimeout(
                                scrapeNotebooks(
                                    brand.coupangBrandParam,
                                    brand.englishName,
                                    {
                                        batchSize: batchSize * multiplier, // Configurable multiplier for duplicate coverage
                                        minPrice: minPrice || 500000,
                                        maxPrice: maxPrice || 2500000,
                                        sortBy: sortBy || 'salesCountDesc',
                                        maxPages: 5,
                                    }
                                ),
                                SCRAPE_TIMEOUT_MS,
                                `${brand.koreanName} scraping`,
                            );

                            const scrapeDurationSec = ((Date.now() - brandStartTime) / 1000).toFixed(1);

                            // Warn if 0 products scraped
                            if (scraped.length === 0) {
                                sendEvent({
                                    type: 'scrape_empty',
                                    brand: brand.koreanName,
                                    searchQuery,
                                    message: `${brand.koreanName}: 스크래핑 결과 0개. 가능한 원인: 1) 셀렉터 변경 2) 검색어 불일치 3) 해당 가격대 제품 없음 4) 쿠팡 접근 차단`,
                                    durationSec: scrapeDurationSec,
                                });
                                details.push({
                                    brand: brand.koreanName,
                                    registered: [],
                                    skipped: [],
                                    errors: [`스크래핑 결과 0개 (검색: ${searchQuery})`],
                                });
                                continue;
                            }

                            // Filter out already registered products
                            const newProducts = scraped.filter(
                                p => !existingUrls.has(normalizeUrl(p.url))
                            );

                            const skippedCount = scraped.length - newProducts.length;
                            const toRegister = newProducts.slice(0, batchSize);

                            sendEvent({
                                type: 'scrape_complete',
                                brand: brand.koreanName,
                                message: `${brand.koreanName}: ${scraped.length}개 스크래핑 → ${newProducts.length}개 신규 (${skippedCount}개 중복)`,
                                totalScraped: scraped.length,
                                newProducts: newProducts.length,
                                duplicates: skippedCount,
                                toRegister: toRegister.length,
                                durationSec: scrapeDurationSec,
                            });

                            // Warn if key fields are missing
                            const missingRating = toRegister.filter(p => !p.rating && p.rating !== 0).length;
                            const missingReviews = toRegister.filter(p => !p.reviewCount && p.reviewCount !== 0).length;
                            if (missingRating > 0 || missingReviews > 0) {
                                sendEvent({
                                    type: 'warning',
                                    brand: brand.koreanName,
                                    message: `${brand.koreanName}: ${missingRating}개 rating 누락, ${missingReviews}개 reviewCount 누락`,
                                });
                            }

                            // Insert into Supabase with retry
                            const registered: Array<{ url: string; productName: string; currentPrice: number }> = [];
                            const errors: string[] = [];

                            for (const product of toRegister) {
                                const insertPayload = {
                                    user_id: userId,
                                    url: product.url,
                                    product_name: product.productName,
                                    current_price: product.currentPrice,
                                    original_price: product.originalPrice,
                                    discount_rate: product.discountRate,
                                    rating: product.rating,
                                    review_count: product.reviewCount,
                                    monthly_purchases: product.monthlyPurchases,
                                    last_updated: new Date().toISOString(),
                                };

                                let insertError: string | null = null;

                                // Attempt insert with 1 retry
                                for (let attempt = 0; attempt < 2; attempt++) {
                                    try {
                                        const { error } = await supabase
                                            .from('products')
                                            .insert(insertPayload);

                                        if (error) {
                                            insertError = `[Supabase] ${error.code}: ${error.message}`;
                                            if (attempt === 0) {
                                                await new Promise(r => setTimeout(r, 500));
                                                continue;
                                            }
                                        } else {
                                            insertError = null;
                                            registered.push({
                                                url: product.url,
                                                productName: product.productName,
                                                currentPrice: product.currentPrice,
                                            });
                                            existingUrls.add(normalizeUrl(product.url));
                                            totalRegistered++;
                                            break;
                                        }
                                    } catch (err) {
                                        insertError = `[Exception] ${String(err)}`;
                                        if (attempt === 0) {
                                            await new Promise(r => setTimeout(r, 500));
                                            continue;
                                        }
                                    }
                                }

                                if (insertError) {
                                    errors.push(`${product.productName}: ${insertError}`);
                                    totalFailed++;
                                }
                            }

                            totalSkipped += skippedCount;

                            const brandDurationSec = ((Date.now() - brandStartTime) / 1000).toFixed(1);

                            details.push({
                                brand: brand.koreanName,
                                registered,
                                skipped: Array(skippedCount).fill('중복 URL'),
                                errors,
                            });

                            sendEvent({
                                type: 'brand_complete',
                                brand: brand.koreanName,
                                message: `${brand.koreanName}: ${registered.length}개 등록, ${skippedCount}개 스킵 (${brandDurationSec}초)`,
                                registered: registered.length,
                                skipped: skippedCount,
                                failed: errors.length,
                                durationSec: brandDurationSec,
                                current: i + 1,
                                total: brands.length,
                            });
                        } catch (err) {
                            const brandDurationSec = ((Date.now() - brandStartTime) / 1000).toFixed(1);
                            const isBrowserCrash = isBrowserClosedError(err);
                            const errorMsg = isBrowserCrash
                                ? `${brand.koreanName} 스크래핑 실패: 브라우저가 비정상 종료되었습니다.`
                                : `${brand.koreanName} 스크래핑 실패: ${String(err)}`;

                            details.push({
                                brand: brand.koreanName,
                                registered: [],
                                skipped: [],
                                errors: [errorMsg],
                            });
                            totalFailed++;

                            sendEvent({
                                type: 'error',
                                brand: brand.koreanName,
                                message: errorMsg,
                                searchQuery,
                                durationSec: brandDurationSec,
                            });

                            // Browser crash recovery: wait 5s and continue to next brand
                            if (isBrowserCrash) {
                                sendEvent({
                                    type: 'warning',
                                    message: `브라우저 크래시 감지. 5초 대기 후 다음 브랜드로 계속합니다... (${brands.length - i - 1}개 남음)`,
                                });
                                await new Promise(r => setTimeout(r, 5000));
                            }
                        }
                    }

                    // Send final result
                    sendEvent({
                        type: 'result',
                        message: `완료: ${totalRegistered}개 등록, ${totalSkipped}개 스킵, ${totalFailed}개 실패`,
                        data: {
                            success: true,
                            registered: totalRegistered,
                            skipped: totalSkipped,
                            failed: totalFailed,
                            details,
                        },
                    });
                } catch (err) {
                    sendEvent({
                        type: 'error',
                        message: `오류 발생: ${String(err)}`,
                    });
                } finally {
                    clearTimeout(totalTimer);
                    closeStream();
                }
            })();
        },
        cancel() {
            // Client disconnected
            writerClosed = true;
            abortController.abort();
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
