// Core AI Product Normalizer Service
// Uses Gemini 2.0 Flash to normalize Coupang product names

import { createHash } from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { NormalizedProduct, NormalizationResult, NormalizationBatchResponse } from './productNormalizerTypes';
import { classifyProductLine } from './productLineClassifier';

const BATCH_SIZE = 15;
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 2000;
const CONFIDENCE_THRESHOLD = 0.5;
const CACHE_TTL_DAYS = 30;
const GEMINI_CALL_TIMEOUT_MS = 15000;
const GLOBAL_TIME_BUDGET_MS = 25000;

const SYSTEM_PROMPT = `You are a Korean e-commerce product name normalizer for Coupang.

## Rules
1. STRIP all noise: seller markers ([정품], ★특가★, 무료배송, 당일출고, 사은품증정, 공식파트너, 한컴오피스팩 동봉), SKU/model numbers (NT960XGQ-A71A, MQT93KH/A, (362589), M3607HA-SH112), detailed specs (16GB, 256GB SSD, DDR5, 8코어, FHD, WQXGA), colors (스페이스그레이, 실버, 블랙, 그레이, 화이트, 매트 그레이), shipping/warranty info, OS info (WIN11 Home, Free DOS, MAC OS).
2. KEEP: brand, product line name, generation/version, chip/processor family (M3, Ultra 7, Ryzen 9, 코어i5), form factor if it differentiates (14인치 vs 16인치 only when it defines a distinct product line), and GPU model for gaming laptops.
3. When brand appears in both English and Korean (e.g., "Apple 애플", "Samsung 삼성"), use the more commonly searched form in Korea.
4. For trend_keywords, generate terms that KOREAN CONSUMERS actually type into search engines. Prioritize: Korean name > English name. Always include at least one pure-Korean keyword. Keywords should be SPECIFIC enough to distinguish from other products.
5. If a product is an accessory (case, charger, cable), set category to "액세서리" and product_line to the target device name.
6. If a product is a bundle (본체+모니터), extract only the primary product.
7. If a product is refurbished/리퍼, include "리퍼" in the product_line.
8. year should be the product release year, NOT the current year, inferred from context. If unknown, set to null.
9. For gaming laptops, include the GPU in product_line if it's a key differentiator.

## Categories
노트북, 데스크탑, 태블릿, 모니터, 키보드, 마우스, 액세서리, 기타

## Output Format (strict JSON array, no markdown)
Each object: {"brand":"str","product_line":"str","generation":"str or null","year":"str or null","trend_keywords":["k1","k2","k3"],"category":"str","confidence":0.0-1.0}

## Examples
Input: "삼성전자 갤럭시북5 프로 NT960XHZ-A52A 인텔 울트라5 16인치 고해상도 AI 노트북"
Output: {"brand":"삼성","product_line":"갤럭시북5 프로 16","generation":"울트라5","year":"2025","trend_keywords":["갤럭시북5 프로","갤럭시북5 프로 16인치","Galaxy Book5 Pro"],"category":"노트북","confidence":0.95}

Input: "Apple 2024 맥미니 M4 Pro 24GB 512GB"
Output: {"brand":"Apple","product_line":"맥미니 M4 Pro","generation":"M4 Pro","year":"2024","trend_keywords":["맥미니 M4 프로","맥미니 2024","Mac Mini M4 Pro"],"category":"데스크탑","confidence":0.95}

Input: "노트킹 65W GaN PPS PD 초소형 초고속 충전기 | C타입 케이블일체형"
Output: {"brand":"노트킹","product_line":"65W GaN USB-C 충전기","generation":null,"year":null,"trend_keywords":["노트북 충전기 65W","USB-C PD 충전기 GaN"],"category":"액세서리","confidence":0.75}`;

/**
 * Compute SHA-256 hash of product name (trimmed, lowercased)
 */
export async function computeProductHash(name: string): Promise<string> {
    return createHash('sha256').update(name.trim().toLowerCase()).digest('hex');
}

/**
 * Compute deterministic line ID from brand, product line, and generation
 */
export function computeLineId(brand: string, productLine: string, generation: string | null): string {
    return `${brand}-${productLine}-${generation || ''}`
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9가-힣-]/g, '');
}

/**
 * Convert classifyProductLine result to NormalizationResult
 */
function fallbackToRegex(originalName: string): NormalizationResult {
    const classified = classifyProductLine(originalName);
    const normalized: NormalizedProduct = {
        brand: classified.brand,
        product_line: classified.displayName,
        generation: classified.generation ?? null,
        year: null,
        trend_keywords: [classified.searchKeyword],
        category: classified.category ?? '기타',
        confidence: 0.3,
    };
    const lineId = computeLineId(classified.brand, classified.displayName, classified.generation ?? null);
    return {
        originalName,
        normalized,
        lineId,
        source: 'regex-fallback',
    };
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main normalization function: normalizes Coupang product names using Gemini AI with caching
 */
export async function normalizeProducts(
    productNames: string[],
    supabaseUrl: string,
    serviceKey: string,
    geminiApiKey: string,
    forceRefresh = false,
): Promise<NormalizationBatchResponse> {
    const startTime = Date.now();
    const response: NormalizationBatchResponse = {
        success: true,
        results: [],
        fromCache: 0,
        fromAI: 0,
        fromFallback: 0,
        errors: [],
    };

    if (productNames.length === 0) {
        return response;
    }

    // Step 1: Hash all product names
    const hashMap = new Map<string, string>(); // hash -> originalName
    for (const name of productNames) {
        const hash = await computeProductHash(name);
        hashMap.set(hash, name);
    }

    const allHashes = Array.from(hashMap.keys());
    let namesToProcess: string[] = [...productNames];

    // Step 2: Check Supabase cache (unless forceRefresh)
    if (!forceRefresh && supabaseUrl && serviceKey) {
        try {
            const supabase = createClient(supabaseUrl, serviceKey);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - CACHE_TTL_DAYS);

            const { data: cached, error } = await supabase
                .from('normalized_products')
                .select('*')
                .in('product_name_hash', allHashes)
                .gte('updated_at', cutoffDate.toISOString());

            if (!error && cached && cached.length > 0) {
                const cachedHashes = new Set<string>();

                for (const row of cached) {
                    cachedHashes.add(row.product_name_hash);
                    const originalName = hashMap.get(row.product_name_hash) ?? row.original_name ?? '';
                    const normalized: NormalizedProduct = {
                        brand: row.brand,
                        product_line: row.product_line,
                        generation: row.generation ?? null,
                        year: row.year ?? null,
                        trend_keywords: row.trend_keywords ?? [],
                        category: row.category,
                        confidence: row.confidence ?? 1.0,
                    };
                    response.results.push({
                        originalName,
                        normalized,
                        lineId: row.line_id ?? computeLineId(row.brand, row.product_line, row.generation),
                        source: 'cache',
                    });
                    response.fromCache++;
                }

                // Filter out cached names
                namesToProcess = productNames.filter(async name => {
                    const hash = await computeProductHash(name);
                    return !cachedHashes.has(hash);
                }) as unknown as string[];

                // Recompute synchronously for filtering
                namesToProcess = [];
                for (const name of productNames) {
                    const hash = await computeProductHash(name);
                    if (!cachedHashes.has(hash)) {
                        namesToProcess.push(name);
                    }
                }
            }
        } catch (err) {
            response.errors.push(`Cache lookup failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    if (namesToProcess.length === 0) {
        return response;
    }

    // Step 3: Initialize Gemini
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-3-flash-preview',
        systemInstruction: SYSTEM_PROMPT,
        generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json',
        },
    });

    // Step 4: Process in batches (startTime은 함수 시작 시점 기준)
    for (let i = 0; i < namesToProcess.length; i += BATCH_SIZE) {
        // 전체 시간 예산 초과 시 나머지 전부 regex fallback
        if (Date.now() - startTime > GLOBAL_TIME_BUDGET_MS) {
            console.warn(`[Normalizer] Time budget exceeded (${GLOBAL_TIME_BUDGET_MS}ms). Falling back to regex for remaining ${namesToProcess.length - i} products.`);
            for (let k = i; k < namesToProcess.length; k++) {
                response.results.push(fallbackToRegex(namesToProcess[k]));
                response.fromFallback++;
            }
            break;
        }

        const batch = namesToProcess.slice(i, i + BATCH_SIZE);
        let batchProcessed = false;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const userPrompt = JSON.stringify(batch);
                let timerId: ReturnType<typeof setTimeout>;
                const timeoutPromise = new Promise<never>((_, reject) => {
                    timerId = setTimeout(() => reject(new Error('Gemini timeout')), GEMINI_CALL_TIMEOUT_MS);
                });
                let result;
                try {
                    result = await Promise.race([
                        model.generateContent(userPrompt),
                        timeoutPromise,
                    ]);
                } finally {
                    clearTimeout(timerId!);
                }
                const text = result.response.text();

                let parsed: NormalizedProduct[];
                try {
                    parsed = JSON.parse(text);
                } catch {
                    throw new Error(`Invalid JSON from Gemini: ${text.slice(0, 200)}`);
                }

                if (!Array.isArray(parsed) || parsed.length !== batch.length) {
                    throw new Error(
                        `Array length mismatch: expected ${batch.length}, got ${Array.isArray(parsed) ? parsed.length : 'non-array'}`,
                    );
                }

                // Process each result
                const supabase =
                    supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

                for (let j = 0; j < batch.length; j++) {
                    const originalName = batch[j];
                    const aiResult = parsed[j];

                    let normResult: NormalizationResult;

                    if (!aiResult || aiResult.confidence < CONFIDENCE_THRESHOLD) {
                        // Low confidence: use regex fallback
                        normResult = fallbackToRegex(originalName);
                        response.fromFallback++;
                    } else {
                        const lineId = computeLineId(aiResult.brand, aiResult.product_line, aiResult.generation);
                        normResult = {
                            originalName,
                            normalized: aiResult,
                            lineId,
                            source: 'ai',
                        };
                        response.fromAI++;

                        // Save to cache (fire-and-forget)
                        if (supabase) {
                            computeProductHash(originalName).then(hash => {
                                supabase
                                    .from('normalized_products')
                                    .upsert({
                                        product_name_hash: hash,
                                        original_name: originalName,
                                        brand: aiResult.brand,
                                        product_line: aiResult.product_line,
                                        generation: aiResult.generation,
                                        year: aiResult.year,
                                        trend_keywords: aiResult.trend_keywords,
                                        category: aiResult.category,
                                        confidence: aiResult.confidence,
                                        line_id: lineId,
                                        updated_at: new Date().toISOString(),
                                    })
                                    .then(() => {}, () => {});
                            });
                        }
                    }

                    response.results.push(normResult);
                }

                batchProcessed = true;
                break;
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                if (attempt < MAX_RETRIES) {
                    await sleep(RETRY_DELAY_MS);
                } else {
                    response.errors.push(`Batch ${i / BATCH_SIZE + 1} failed after ${MAX_RETRIES + 1} attempts: ${errMsg}`);
                }
            }
        }

        // If all retries failed, use regex fallback for entire batch
        if (!batchProcessed) {
            for (const name of batch) {
                response.results.push(fallbackToRegex(name));
                response.fromFallback++;
            }
        }
    }

    response.success = response.errors.length === 0 || response.results.length > 0;
    return response;
}
