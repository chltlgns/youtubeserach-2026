'use client';

import { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, RefreshCw, Trash2, Download, Plus, Zap, Loader2, LogIn, LogOut, User as UserIcon, BarChart3, Star, ArrowUpDown, ChevronUp, ChevronDown, Users, Video, Award, Tag, TrendingUp } from 'lucide-react';
import { supabase, CoupangProductDB } from '@/lib/supabase';
import AuthModal from '@/components/auth/AuthModal';
import PriceHistoryModal from '@/components/coupang/PriceHistoryModal';
import TrendDetailModal from '@/components/coupang/TrendDetailModal';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { classifyBrand, BRAND_COLORS } from '@/lib/brandClassifier';
import { calculateProductScore, ProductScoreResult } from '@/lib/productScoring';
import { CoupangProduct, CoupangScrapedData } from '@/lib/coupangTypes';
import { TrendResult, TrendFetchResponse, ProductLine } from '@/lib/trendTypes';
import { getUniqueProductLines, getProductLineId } from '@/lib/productLineClassifier';
import { NormalizationBatchResponse, NormalizationResult } from '@/lib/productNormalizerTypes';

// Sort types
type SortField = 'productName' | 'currentPrice' | 'discountRate' | 'priceChangeRate' | 'rating' | 'reviewCount' | 'monthlyPurchases' | 'lastUpdated' | 'brand' | 'score' | 'trend' | null;
type SortDirection = 'asc' | 'desc';

const RESET_HOUR = 9; // 오전 9시 기준 리셋

function safeNavigate(url: string): boolean {
    try {
        const parsed = new URL(url);
        if (!['https:', 'http:'].includes(parsed.protocol)) return false;
        if (!parsed.hostname.endsWith('coupang.com')) return false;
        window.location.href = url;
        return true;
    } catch {
        return false;
    }
}

export default function CoupangPage() {
    const [products, setProducts] = useState<CoupangProduct[]>([]);
    const [lastResetDate, setLastResetDate] = useState<string>('');
    const [inputData, setInputData] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateProgress, setUpdateProgress] = useState('');
    const [user, setUser] = useState<SupabaseUser | null>(null);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showPriceHistoryModal, setShowPriceHistoryModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<CoupangProduct | null>(null);
    const [showTrendModal, setShowTrendModal] = useState(false);
    const [selectedTrendProduct, setSelectedTrendProduct] = useState<CoupangProduct | null>(null);
    const [sortField, setSortField] = useState<SortField>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [productScores, setProductScores] = useState<Record<string, ProductScoreResult>>({});
    const [lowestPrices, setLowestPrices] = useState<Record<string, number>>({});
    const [trendData, setTrendData] = useState<Record<string, TrendResult>>({});
    const [isTrendLoading, setIsTrendLoading] = useState(false);
    const [lastTrendUpdate, setLastTrendUpdate] = useState<string | null>(null);

    // 병렬 워커 파라미터 읽기
    const [workerIndex, setWorkerIndex] = useState(-1);
    const [totalWorkers, setTotalWorkers] = useState(1);
    const [autostart, setAutostart] = useState(false);
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const w = parseInt(params.get('worker') || '-1');
        const t = parseInt(params.get('total') || '1');
        const auto = params.get('autostart') === '1';
        if (w >= 0 && t > 1) {
            setWorkerIndex(w);
            setTotalWorkers(t);
        }
        setAutostart(auto);
    }, []);
    const isParallelMode = workerIndex >= 0 && totalWorkers > 1;

    // Check auth state
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Load products from Supabase
    const loadProducts = useCallback(async () => {
        if (!user) {
            setProducts([]);
            setIsLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const mappedProducts: CoupangProduct[] = (data || []).map((p: CoupangProductDB) => ({
                id: p.id,
                url: p.url,
                productName: p.product_name,
                currentPrice: p.current_price,
                originalPrice: p.original_price,
                discountRate: p.discount_rate,
                previousPrice: p.previous_price ?? undefined,
                priceChangeRate: p.price_change_rate ?? undefined,
                rating: p.rating ?? undefined,
                reviewCount: p.review_count ?? undefined,
                monthlyPurchases: p.monthly_purchases ?? undefined,
                lastUpdated: p.last_updated,
                videoCompletedAt: p.video_completed_at ?? null,
                brand: p.brand ?? classifyBrand(p.product_name),
            }));

            // Auto-classify brands for products without brand
            const productsWithoutBrand = (data || []).filter((p: CoupangProductDB) => !p.brand);
            if (productsWithoutBrand.length > 0) {
                const updates = productsWithoutBrand.map((p: CoupangProductDB) => ({
                    id: p.id,
                    brand: classifyBrand(p.product_name),
                }));
                // Update brands in background (don't await)
                Promise.all(
                    updates.map(u =>
                        supabase.from('products').update({ brand: u.brand }).eq('id', u.id)
                    )
                ).catch(err => console.error('Error auto-classifying brands:', err));
            }

            setProducts(mappedProducts);
            checkAndReset();
        } catch (error) {
            console.error('Error loading products:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadProducts();

        // 업데이트 완료 알림 확인
        const completeCount = sessionStorage.getItem('coupang_update_complete');
        if (completeCount) {
            sessionStorage.removeItem('coupang_update_complete');
            const params = new URLSearchParams(window.location.search);
            const w = params.get('worker');
            setTimeout(() => {
                if (w !== null) {
                    alert(`✅ 워커 ${w}: ${completeCount}개 제품 업데이트 완료!\n이 창을 닫아도 됩니다.`);
                    window.close();
                } else {
                    alert(`✅ 모든 제품(${completeCount}개) 업데이트 완료!`);
                }
            }, 1000);
        }
    }, [loadProducts]);

    // 병렬 워커 자동 시작 (autostart=1 파라미터)
    useEffect(() => {
        if (!autostart || !isParallelMode || products.length === 0 || isUpdating) return;
        if (sessionStorage.getItem('coupang_update_queue')) return;
        if (sessionStorage.getItem('coupang_autostart_done')) return;

        const myProducts = products
            .filter((_, i) => i % totalWorkers === workerIndex)
            .sort((a, b) => new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime());
        if (myProducts.length === 0) return;

        const urls = myProducts.map(p => p.url);

        sessionStorage.setItem('coupang_autostart_done', 'true');
        sessionStorage.setItem('coupang_update_queue', JSON.stringify(urls));
        sessionStorage.setItem('coupang_update_index', '0');
        sessionStorage.setItem('coupang_update_in_progress', 'true');

        console.log(`[워커${workerIndex}][YGIF] 자동 시작, ${urls.length}개 제품`);

        setTimeout(() => {
            safeNavigate(urls[0]);
        }, 1000);
    }, [autostart, isParallelMode, products, workerIndex, totalWorkers, isUpdating]);

    // Calculate product scores
    useEffect(() => {
        if (products.length === 0) return;

        const calculateScores = async () => {
            // Fetch lowest prices for all products
            const productIds = products.map(p => p.id);
            const { data: priceData } = await supabase
                .from('price_history')
                .select('product_id, price')
                .in('product_id', productIds);

            // Build lowest price map
            const lowest: Record<string, number> = {};
            (priceData || []).forEach((ph: { product_id: string; price: number }) => {
                if (!lowest[ph.product_id] || ph.price < lowest[ph.product_id]) {
                    lowest[ph.product_id] = ph.price;
                }
            });
            setLowestPrices(lowest);

            // Collect all purchases and reviews for normalization
            const allPurchases = products.map(p => p.monthlyPurchases ?? 0);
            const allReviews = products.map(p => p.reviewCount ?? 0);

            // Find brand video dates (most recent video_completed_at per brand, excluding self)
            const brandVideoMap: Record<string, string> = {};
            products.forEach(p => {
                const brand = p.brand || classifyBrand(p.productName);
                if (p.videoCompletedAt) {
                    if (!brandVideoMap[brand] || p.videoCompletedAt > brandVideoMap[brand]) {
                        brandVideoMap[brand] = p.videoCompletedAt;
                    }
                }
            });

            // Calculate scores
            const scores: Record<string, ProductScoreResult> = {};
            products.forEach(p => {
                const brand = p.brand || classifyBrand(p.productName);
                // Brand video: use the most recent from OTHER products of same brand
                let brandVideoDate: string | null = null;
                const otherBrandVideos = products
                    .filter(other => other.id !== p.id && (other.brand || classifyBrand(other.productName)) === brand && other.videoCompletedAt)
                    .map(other => other.videoCompletedAt!)
                    .sort((a, b) => b.localeCompare(a));
                if (otherBrandVideos.length > 0) {
                    brandVideoDate = otherBrandVideos[0];
                }

                // Get trend data for this product's line
                const lineId = getProductLineId(p.productName);
                const trend = trendData[lineId] ?? null;
                const trendInput = trend ? {
                    currentValue: trend.currentValue,
                    trendDirection: trend.trendDirection,
                    trendSlope: trend.trendSlope,
                } : null;

                scores[p.id] = calculateProductScore(
                    {
                        monthlyPurchases: p.monthlyPurchases,
                        reviewCount: p.reviewCount,
                        currentPrice: p.currentPrice,
                        lowestPrice: lowest[p.id] || p.currentPrice,
                        videoCompletedAt: p.videoCompletedAt,
                        brand,
                        brandVideoCompletedAt: brandVideoDate,
                        trendData: trendInput,
                    },
                    allPurchases,
                    allReviews
                );
            });
            setProductScores(scores);
        };

        calculateScores();
    }, [products, trendData]);

    // 순차 업데이트 진행 확인 (뒤로 가기로 돌아왔을 때만)
    useEffect(() => {
        const isInProgress = sessionStorage.getItem('coupang_update_in_progress');
        if (!isInProgress) {
            sessionStorage.removeItem('coupang_update_queue');
            sessionStorage.removeItem('coupang_update_index');
            return;
        }

        const processingKey = 'coupang_update_processing';
        if (sessionStorage.getItem(processingKey)) {
            return;
        }

        const queueStr = sessionStorage.getItem('coupang_update_queue');
        const indexStr = sessionStorage.getItem('coupang_update_index');

        if (!queueStr || indexStr === null) {
            sessionStorage.removeItem('coupang_update_in_progress');
            return;
        }

        const urls = JSON.parse(queueStr) as string[];
        const currentIndex = parseInt(indexStr);

        if (currentIndex < 0) return;

        sessionStorage.setItem(processingKey, 'true');

        const params = new URLSearchParams(window.location.search);
        const w = params.get('worker');
        const label = w !== null ? `[워커${w}] ` : '';

        console.log(`${label}[YGIF] 뒤로 가기 감지 - 인덱스: ${currentIndex}, 전체: ${urls.length}`);

        const nextIndex = currentIndex + 1;

        if (nextIndex >= urls.length) {
            sessionStorage.removeItem('coupang_update_queue');
            sessionStorage.removeItem('coupang_update_index');
            sessionStorage.removeItem(processingKey);
            sessionStorage.removeItem('coupang_update_in_progress');
            sessionStorage.setItem('coupang_update_complete', urls.length.toString());

            console.log(`${label}[YGIF] 모든 업데이트 완료! 페이지 새로고침...`);
            window.location.reload();
        } else {
            console.log(`${label}[YGIF] 다음 제품으로 이동: ${nextIndex + 1}/${urls.length}`);
            sessionStorage.setItem('coupang_update_index', nextIndex.toString());
            setUpdateProgress(`${label}업데이트 중: ${nextIndex + 1}/${urls.length}`);
            setIsUpdating(true);

            setTimeout(() => {
                sessionStorage.removeItem(processingKey);
                safeNavigate(urls[nextIndex]);
            }, 1500);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Fetch trend data for all products
    const fetchTrendData = useCallback(async (forceRefresh = false) => {
        if (products.length === 0) return;
        setIsTrendLoading(true);

        try {
            const productNames = products.map(p => p.productName);

            const { data: { session } } = await supabase.auth.getSession();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }

            // Try AI normalization first, fall back to regex
            let productLines: ProductLine[] | undefined;
            try {
                const normalizeRes = await fetch('/api/normalize', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ productNames, forceRefresh }),
                });

                if (normalizeRes.ok) {
                    const normData: NormalizationBatchResponse = await normalizeRes.json();
                    if (normData.success && normData.results.length > 0) {
                        // Deduplicate by lineId and convert to ProductLine format
                        const seen = new Set<string>();
                        productLines = [] as ProductLine[];
                        for (const r of normData.results) {
                            if (!seen.has(r.lineId)) {
                                seen.add(r.lineId);
                                productLines.push({
                                    lineId: r.lineId,
                                    displayName: r.normalized.product_line,
                                    searchKeyword: r.normalized.trend_keywords[0] || r.normalized.product_line,
                                    brand: r.normalized.brand,
                                    category: r.normalized.category,
                                    generation: r.normalized.generation || undefined,
                                });
                            }
                        }
                    }
                }
            } catch (normalizeError) {
                console.warn('AI normalization failed, using regex fallback:', normalizeError);
            }

            // Fallback to regex classifier if normalization failed
            if (!productLines || productLines.length === 0) {
                productLines = getUniqueProductLines(productNames);
            }

            const response = await fetch('/api/trends', {
                method: 'POST',
                headers,
                body: JSON.stringify({ productLines, forceRefresh }),
            });

            const data: TrendFetchResponse = await response.json();

            if (data.success && data.results.length > 0) {
                const trendMap: Record<string, TrendResult> = {};
                for (const result of data.results) {
                    trendMap[result.lineId] = result;
                }
                setTrendData(trendMap);
                setLastTrendUpdate(new Date().toLocaleString('ko-KR'));
            }
        } catch (error) {
            console.error('Error fetching trend data:', error);
        } finally {
            setIsTrendLoading(false);
        }
    }, [products]);

    // Check if daily reset is needed
    const checkAndReset = () => {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const hour = now.getHours();

        if (hour >= RESET_HOUR && lastResetDate !== today) {
            setLastResetDate(today);
        }
    };

    // Calculate price change
    const calculatePriceChange = (current: number, previous: number): string => {
        if (!previous || previous === 0) return '0%';
        const change = ((current - previous) / previous) * 100;
        return change >= 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
    };

    // Format price with comma
    const formatPrice = (price: number): string => {
        return price.toLocaleString() + '원';
    };

    // Get color based on price change
    const getPriceChangeColor = (change?: string): string => {
        if (!change) return 'text-gray-400';
        if (change.startsWith('+')) return 'text-red-400';
        if (change.startsWith('-')) return 'text-green-400';
        return 'text-gray-400';
    };

    // Sort handler
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    // Sorted products - 정렬이 없으면 원래 순서(생성일 내림차순) 유지
    const sortedProducts = sortField === null ? products : [...products].sort((a, b) => {
        let aVal: number | string | null | undefined;
        let bVal: number | string | null | undefined;

        switch (sortField) {
            case 'productName':
                aVal = a.productName;
                bVal = b.productName;
                break;
            case 'currentPrice':
                aVal = a.currentPrice;
                bVal = b.currentPrice;
                break;
            case 'discountRate':
                aVal = parseInt(a.discountRate) || 0;
                bVal = parseInt(b.discountRate) || 0;
                break;
            case 'priceChangeRate':
                aVal = parseFloat(a.priceChangeRate?.replace(/[+%]/g, '') || '0');
                bVal = parseFloat(b.priceChangeRate?.replace(/[+%]/g, '') || '0');
                break;
            case 'rating':
                aVal = a.rating ?? 0;
                bVal = b.rating ?? 0;
                break;
            case 'reviewCount':
                aVal = a.reviewCount ?? 0;
                bVal = b.reviewCount ?? 0;
                break;
            case 'monthlyPurchases':
                aVal = a.monthlyPurchases ?? 0;
                bVal = b.monthlyPurchases ?? 0;
                break;
            case 'brand':
                aVal = a.brand || classifyBrand(a.productName);
                bVal = b.brand || classifyBrand(b.productName);
                break;
            case 'trend':
                aVal = productScores[a.id]?.trendScore ?? 0;
                bVal = productScores[b.id]?.trendScore ?? 0;
                break;
            case 'score':
                aVal = productScores[a.id]?.totalScore ?? 0;
                bVal = productScores[b.id]?.totalScore ?? 0;
                break;
            case 'lastUpdated':
            default:
                aVal = new Date(a.lastUpdated).getTime();
                bVal = new Date(b.lastUpdated).getTime();
                break;
        }

        if (typeof aVal === 'string' && typeof bVal === 'string') {
            return sortDirection === 'asc'
                ? aVal.localeCompare(bVal, 'ko')
                : bVal.localeCompare(aVal, 'ko');
        }

        const numA = Number(aVal) || 0;
        const numB = Number(bVal) || 0;
        return sortDirection === 'asc' ? numA - numB : numB - numA;
    });

    // Sort icon component
    const SortIcon = ({ field }: { field: Exclude<SortField, null> }) => {
        if (sortField !== field) {
            return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
        }
        return sortDirection === 'asc'
            ? <ChevronUp className="w-3 h-3 ml-1 text-blue-400" />
            : <ChevronDown className="w-3 h-3 ml-1 text-blue-400" />;
    };

    // Sanitize string: strip HTML tags and script content
    const sanitizeString = (str: string): string => {
        if (typeof str !== 'string') return '';
        return str
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<[^>]*>/g, '')
            .trim();
    };

    // Parse input data
    const parseInputData = (input: string): CoupangScrapedData | null => {
        try {
            const data = JSON.parse(input);
            if (data.url && data.productName && typeof data.currentPrice === 'number') {
                return {
                    url: sanitizeString(data.url),
                    productName: sanitizeString(data.productName),
                    currentPrice: Number(data.currentPrice) || 0,
                    originalPrice: Number(data.originalPrice) || 0,
                    discountRate: sanitizeString(data.discountRate),
                };
            }
        } catch {
            // Try parsing different format
        }
        return null;
    };

    // Add or update product
    const handleAddProduct = useCallback(async () => {
        if (!inputData.trim() || !user) return;

        const parsed = parseInputData(inputData);
        if (!parsed) {
            alert('데이터 형식이 올바르지 않습니다.');
            return;
        }

        // Check if product already exists
        const existing = products.find(p => p.url === parsed.url);

        try {
            if (existing) {
                // Update existing product
                const { error } = await supabase
                    .from('products')
                    .update({
                        product_name: parsed.productName,
                        previous_price: existing.currentPrice,
                        current_price: parsed.currentPrice,
                        original_price: parsed.originalPrice,
                        discount_rate: parsed.discountRate,
                        price_change_rate: calculatePriceChange(parsed.currentPrice, existing.currentPrice),
                        last_updated: new Date().toISOString(),
                    })
                    .eq('id', existing.id);

                if (error) throw error;
            } else {
                // Insert new product
                const { error } = await supabase
                    .from('products')
                    .insert({
                        user_id: user.id,
                        url: parsed.url,
                        product_name: parsed.productName,
                        current_price: parsed.currentPrice,
                        original_price: parsed.originalPrice,
                        discount_rate: parsed.discountRate,
                        last_updated: new Date().toISOString(),
                    });

                if (error) throw error;
            }

            setInputData('');
            loadProducts();
        } catch (error) {
            console.error('Error adding product:', error);
            alert('제품 추가에 실패했습니다.');
        }
    }, [inputData, products, user, loadProducts]);

    // Delete product
    const handleDelete = async (id: string) => {
        if (!confirm('이 제품을 삭제하시겠습니까?')) return;

        try {
            const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', id);

            if (error) throw error;
            loadProducts();
        } catch (error) {
            console.error('Error deleting product:', error);
        }
    };

    // Video completion handlers
    const handleVideoComplete = async (productId: string) => {
        if (!confirm('이 제품의 영상을 생성했습니까? 점수 패널티가 적용됩니다.')) return;

        try {
            const now = new Date().toISOString();
            const { error } = await supabase
                .from('products')
                .update({ video_completed_at: now })
                .eq('id', productId);

            if (error) throw error;
            loadProducts(); // Reload to recalculate scores
        } catch (error) {
            console.error('Error marking video complete:', error);
        }
    };

    const handleVideoReset = async (productId: string) => {
        if (!confirm('영상 생성 기록을 초기화하시겠습니까?')) return;

        try {
            const { error } = await supabase
                .from('products')
                .update({ video_completed_at: null })
                .eq('id', productId);

            if (error) throw error;
            loadProducts();
        } catch (error) {
            console.error('Error resetting video:', error);
        }
    };

    // Reset all data
    const handleResetAll = async () => {
        if (!confirm('모든 데이터를 초기화하시겠습니까?') || !user) return;

        try {
            const { error } = await supabase
                .from('products')
                .delete()
                .eq('user_id', user.id);

            if (error) throw error;
            setProducts([]);
            setLastResetDate(new Date().toISOString().split('T')[0]);
        } catch (error) {
            console.error('Error resetting products:', error);
        }
    };

    // 전체 업데이트 - 3개 창을 열어 병렬로 처리
    const handleAutoUpdate = async () => {
        if (products.length === 0) {
            alert('업데이트할 제품이 없습니다.');
            return;
        }

        // 메인 창: 워커 창 열기 (confirm 없이 즉시 - 팝업 차단 방지)
        if (!isParallelMode) {
            const WORKER_COUNT = Math.min(3, products.length);

            const openedWindows: (Window | null)[] = [];
            for (let i = 0; i < WORKER_COUNT; i++) {
                const workerUrl = `https://ygif-pied.vercel.app/coupang?worker=${i}&total=${WORKER_COUNT}&autostart=1`;
                const w = window.open(workerUrl, `coupang_worker_${i}`);
                openedWindows.push(w);
            }

            const blockedCount = openedWindows.filter(w => !w).length;
            if (blockedCount > 0) {
                alert(
                    `${blockedCount}개 창이 팝업 차단되었습니다.\n\n` +
                    `Edge 주소창 오른쪽의 팝업 차단 아이콘을 클릭하여\n` +
                    `${window.location.host}의 팝업을 허용한 뒤 다시 시도해주세요.`
                );
            } else {
                setUpdateProgress(`${WORKER_COUNT}개 창에서 병렬 업데이트 시작됨`);
                setTimeout(() => setUpdateProgress(''), 5000);
            }
            return;
        }

        // 워커 창: 자기 담당 제품만 순차 업데이트 (오래된 것부터)
        const myProducts = products
            .filter((_, i) => i % totalWorkers === workerIndex)
            .sort((a, b) => new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime());

        if (myProducts.length === 0) {
            alert(`워커 ${workerIndex}에 할당된 제품이 없습니다.`);
            return;
        }

        const urls = myProducts.map(p => p.url);

        if (!autostart) {
            const confirmed = confirm(
                `[워커 ${workerIndex}/${totalWorkers}] ${myProducts.length}개 제품을 업데이트합니다.\n` +
                `(전체 ${products.length}개 중 이 워커 담당분)\n\n` +
                `시작하시겠습니까?`
            );
            if (!confirmed) return;
        }

        sessionStorage.setItem('coupang_update_queue', JSON.stringify(urls));
        sessionStorage.setItem('coupang_update_index', '0');
        sessionStorage.setItem('coupang_update_in_progress', 'true');

        const label = `[워커${workerIndex}] `;
        console.log(`${label}[YGIF] 업데이트 시작, URL 개수: ${urls.length}`);
        setUpdateProgress(`${label}업데이트 중: 1/${urls.length}`);
        setIsUpdating(true);

        safeNavigate(urls[0]);
    };

    // Continue to next product (called from UI or automatically)
    const handleNextProduct = () => {
        const queueStr = sessionStorage.getItem('coupang_update_queue');
        const indexStr = sessionStorage.getItem('coupang_update_index');

        if (!queueStr || !indexStr) {
            alert('업데이트 큐가 없습니다.');
            return;
        }

        const urls = JSON.parse(queueStr);
        const currentIndex = parseInt(indexStr);
        const nextIndex = currentIndex + 1;

        if (nextIndex >= urls.length) {
            sessionStorage.removeItem('coupang_update_queue');
            sessionStorage.removeItem('coupang_update_index');
            alert(`모든 제품(${urls.length}개) 업데이트 완료!`);
            loadProducts();
            return;
        }

        sessionStorage.setItem('coupang_update_index', nextIndex.toString());
        setUpdateProgress(`업데이트 중: ${nextIndex + 1}/${urls.length}`);

        safeNavigate(urls[nextIndex]);
    };

    // Check if we have pending updates
    const getPendingUpdate = () => {
        const queueStr = sessionStorage.getItem('coupang_update_queue');
        const indexStr = sessionStorage.getItem('coupang_update_index');
        if (!queueStr || !indexStr) return null;

        const urls = JSON.parse(queueStr);
        const currentIndex = parseInt(indexStr);
        return {
            current: currentIndex + 1,
            total: urls.length,
            remaining: urls.length - currentIndex - 1
        };
    };

    const pendingUpdate = getPendingUpdate();

    // Export to CSV
    const handleExportCSV = () => {
        const headers = ['URL', '제품명', '현재가격', '원래가격', '할인율', '전일대비변동율', '마지막업데이트'];
        const rows = products.map(p => [
            p.url,
            p.productName,
            p.currentPrice,
            p.originalPrice,
            p.discountRate,
            p.priceChangeRate || '-',
            new Date(p.lastUpdated).toLocaleString('ko-KR'),
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `coupang_prices_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    // Logout
    const handleLogout = async () => {
        await supabase.auth.signOut();
        setProducts([]);
    };

    // Bookmarklet script
    const bookmarkletScript = `javascript:(function(){const n=document.querySelector('h1.product-title span.twc-font-bold')||document.querySelector('h1.product-title')||document.querySelector('.prod-buy-header__title');const name=n?n.textContent.trim():document.title.split(' - ')[0];const p=document.querySelector('.final-price-amount')||document.querySelector('.price-amount.final-price-amount');let price=p?parseInt(p.textContent.replace(/[^0-9]/g,'')):0;const all=document.querySelectorAll('.price-amount');let orig=price;all.forEach(e=>{const t=parseInt(e.textContent.replace(/[^0-9]/g,''));if(t>orig)orig=t;});const disc=orig>price&&price>0?Math.round((1-price/orig)*100)+'%25':'0%25';const data={url:location.href,productName:name,currentPrice:price,originalPrice:orig,discountRate:decodeURIComponent(disc)};prompt('YGIF에 붙여넣기:',JSON.stringify(data));})();`;

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <ShoppingCart className="w-8 h-8 text-purple-500" />
                    <h1 className="text-2xl font-bold">쿠팡 가격 트래커</h1>
                </div>

                {user ? (
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-400 flex items-center gap-2">
                            <UserIcon className="w-4 h-4" />
                            {user.email}
                        </span>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            로그아웃
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowAuthModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg text-sm font-medium transition-colors"
                    >
                        <LogIn className="w-4 h-4" />
                        로그인
                    </button>
                )}
            </div>

            {/* Auth Required Message */}
            {!user && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6 mb-6 text-center">
                    <p className="text-yellow-400 mb-4">
                        제품을 추가하고 관리하려면 로그인이 필요합니다.
                    </p>
                    <button
                        onClick={() => setShowAuthModal(true)}
                        className="px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-lg transition-colors"
                    >
                        로그인 / 회원가입
                    </button>
                </div>
            )}

            {/* Auth Modal */}
            <AuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                onAuthSuccess={loadProducts}
            />

            {user && (
                <>
                    {/* Input Section */}
                    <div className="bg-white/5 rounded-2xl p-6 mb-6 border border-white/10">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Plus className="w-5 h-5" /> 제품 추가/업데이트
                        </h2>
                        <div className="flex gap-4">
                            <input
                                type="text"
                                value={inputData}
                                onChange={(e) => setInputData(e.target.value)}
                                placeholder='쿠팡 페이지에서 스크립트 실행 후 복사된 데이터를 붙여넣기 (Ctrl+V)'
                                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500 transition-colors"
                            />
                            <button
                                onClick={handleAddProduct}
                                disabled={!inputData.trim()}
                                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors disabled:opacity-50"
                            >
                                추가
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            💡 쿠팡 제품 페이지에서 F12 → Console에 스크립트를 실행하면 데이터가 자동으로 복사됩니다
                        </p>
                    </div>

                    {/* Bookmarklet Guide */}
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-6 mb-6">
                        <h3 className="font-semibold mb-2">📌 북마클릿 설정 방법</h3>
                        <ol className="text-sm text-gray-300 space-y-1 mb-4">
                            <li>1. 아래 버튼을 북마크바로 드래그하세요</li>
                            <li>2. 쿠팡 제품 페이지에서 북마클릿 클릭</li>
                            <li>3. 나타난 데이터를 복사하여 위 입력창에 붙여넣기</li>
                        </ol>
                        <a
                            href={bookmarkletScript}
                            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
                            onClick={(e) => e.preventDefault()}
                            draggable="true"
                        >
                            🔖 쿠팡 가격 추출
                        </a>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-between items-center mb-4">
                        <div className="text-sm text-gray-400">
                            {isParallelMode && (
                                <span className="px-2 py-0.5 bg-blue-600 rounded text-xs font-bold mr-2">
                                    워커 {workerIndex}/{totalWorkers}
                                </span>
                            )}
                            {isParallelMode
                                ? `${products.filter((_, i) => i % totalWorkers === workerIndex).length}개 담당 (전체 ${products.length}개)`
                                : `${products.length}개 제품`
                            } | 마지막 리셋: {lastResetDate || '-'}
                            {lastTrendUpdate && ` | 트렌드: ${lastTrendUpdate}`}
                        </div>
                        <div className="flex gap-2 items-center">
                            {updateProgress && (
                                <span className="text-sm text-yellow-400 animate-pulse">
                                    {updateProgress}
                                </span>
                            )}
                            <button
                                onClick={() => fetchTrendData(true)}
                                disabled={products.length === 0 || isTrendLoading}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                title={lastTrendUpdate ? `마지막 갱신: ${lastTrendUpdate}` : '트렌드 데이터를 아직 조회하지 않았습니다'}
                            >
                                {isTrendLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <TrendingUp className="w-4 h-4" />
                                )}
                                {isTrendLoading ? '조회 중...' : '트렌드 갱신'}
                            </button>
                            <button
                                onClick={handleAutoUpdate}
                                disabled={products.length === 0 || isUpdating}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                            >
                                {isUpdating ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Zap className="w-4 h-4" />
                                )}
                                {isUpdating ? '업데이트 중...' : '전체 업데이트'}
                            </button>
                            <button
                                onClick={handleExportCSV}
                                disabled={products.length === 0}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                            >
                                <Download className="w-4 h-4" />
                                CSV 내보내기
                            </button>
                            <button
                                onClick={handleResetAll}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                                전체 초기화
                            </button>
                        </div>
                    </div>

                    {/* Product Table */}
                    <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-white/5 border-b border-white/10">
                                        <th
                                            className="px-3 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-white/10"
                                            style={{ maxWidth: '250px' }}
                                            onClick={() => handleSort('productName')}
                                        >
                                            <span className="inline-flex items-center">
                                                제품명
                                                <SortIcon field="productName" />
                                            </span>
                                        </th>
                                        <th
                                            className="px-3 py-3 text-right text-sm font-semibold cursor-pointer hover:bg-white/10"
                                            onClick={() => handleSort('currentPrice')}
                                        >
                                            <span className="inline-flex items-center justify-end">
                                                현재가격
                                                <SortIcon field="currentPrice" />
                                            </span>
                                        </th>
                                        <th
                                            className="px-3 py-3 text-center text-sm font-semibold cursor-pointer hover:bg-white/10"
                                            onClick={() => handleSort('discountRate')}
                                        >
                                            <span className="inline-flex items-center justify-center">
                                                할인율
                                                <SortIcon field="discountRate" />
                                            </span>
                                        </th>
                                        <th
                                            className="px-3 py-3 text-center text-sm font-semibold cursor-pointer hover:bg-white/10"
                                            onClick={() => handleSort('priceChangeRate')}
                                        >
                                            <span className="inline-flex items-center justify-center">
                                                전일대비
                                                <SortIcon field="priceChangeRate" />
                                            </span>
                                        </th>
                                        <th
                                            className="px-3 py-3 text-center text-sm font-semibold cursor-pointer hover:bg-white/10"
                                            onClick={() => handleSort('rating')}
                                        >
                                            <span className="inline-flex items-center justify-center">
                                                별점
                                                <SortIcon field="rating" />
                                            </span>
                                        </th>
                                        <th
                                            className="px-3 py-3 text-center text-sm font-semibold cursor-pointer hover:bg-white/10"
                                            onClick={() => handleSort('reviewCount')}
                                        >
                                            <span className="inline-flex items-center justify-center">
                                                리뷰
                                                <SortIcon field="reviewCount" />
                                            </span>
                                        </th>
                                        <th
                                            className="px-3 py-3 text-center text-sm font-semibold cursor-pointer hover:bg-white/10"
                                            onClick={() => handleSort('monthlyPurchases')}
                                        >
                                            <span className="inline-flex items-center justify-center">
                                                구매수
                                                <SortIcon field="monthlyPurchases" />
                                            </span>
                                        </th>
                                        <th
                                            className="px-3 py-3 text-center text-sm font-semibold cursor-pointer hover:bg-white/10"
                                            onClick={() => handleSort('trend')}
                                        >
                                            <span className="inline-flex items-center justify-center">
                                                <TrendingUp className="w-3 h-3 mr-1" />
                                                트렌드
                                                <SortIcon field="trend" />
                                            </span>
                                        </th>
                                        <th
                                            className="px-3 py-3 text-center text-sm font-semibold cursor-pointer hover:bg-white/10"
                                            onClick={() => handleSort('score')}
                                        >
                                            <span className="inline-flex items-center justify-center">
                                                <Award className="w-3 h-3 mr-1" />
                                                점수
                                                <SortIcon field="score" />
                                            </span>
                                        </th>
                                        <th
                                            className="px-3 py-3 text-center text-sm font-semibold cursor-pointer hover:bg-white/10"
                                            onClick={() => handleSort('brand')}
                                        >
                                            <span className="inline-flex items-center justify-center">
                                                <Tag className="w-3 h-3 mr-1" />
                                                브랜드
                                                <SortIcon field="brand" />
                                            </span>
                                        </th>
                                        <th className="px-3 py-3 text-center text-sm font-semibold">영상</th>
                                        <th className="px-3 py-3 text-center text-sm font-semibold">그래프</th>
                                        <th className="px-3 py-3 text-center text-sm font-semibold">삭제</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedProducts.length === 0 ? (
                                        <tr>
                                            <td colSpan={13} className="px-4 py-12 text-center text-gray-500">
                                                추적 중인 제품이 없습니다. 위에서 제품을 추가해주세요.
                                            </td>
                                        </tr>
                                    ) : (
                                        sortedProducts.map((product) => (
                                            <tr key={product.id} className="border-b border-white/5 hover:bg-white/5">
                                                {/* 제품명 - 축소 */}
                                                <td className="px-3 py-3" style={{ maxWidth: '250px' }}>
                                                    <a
                                                        href={product.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-400 hover:underline block truncate"
                                                        title={product.productName}
                                                    >
                                                        {product.productName.length > 40
                                                            ? product.productName.substring(0, 40) + '...'
                                                            : product.productName}
                                                    </a>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        {new Date(product.lastUpdated).toLocaleDateString('ko-KR')}
                                                    </p>
                                                </td>
                                                {/* 현재가격 */}
                                                <td className="px-3 py-3 text-right font-bold text-red-400 whitespace-nowrap">
                                                    {formatPrice(product.currentPrice)}
                                                </td>
                                                {/* 할인율 */}
                                                <td className="px-3 py-3 text-center">
                                                    <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-sm">
                                                        {product.discountRate}
                                                    </span>
                                                </td>
                                                {/* 전일대비 */}
                                                <td className={`px-3 py-3 text-center font-semibold ${getPriceChangeColor(product.priceChangeRate)}`}>
                                                    {product.priceChangeRate || '-'}
                                                </td>
                                                {/* 별점 */}
                                                <td className="px-3 py-3 text-center">
                                                    {product.rating ? (
                                                        <span className="inline-flex items-center gap-1 text-yellow-400 text-sm">
                                                            <Star className="w-3 h-3 fill-current" />
                                                            {product.rating.toFixed(1)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-500 text-sm">-</span>
                                                    )}
                                                </td>
                                                {/* 리뷰 */}
                                                <td className="px-3 py-3 text-center text-sm text-gray-400">
                                                    {product.reviewCount ? (
                                                        <span>{product.reviewCount.toLocaleString()}</span>
                                                    ) : (
                                                        <span className="text-gray-500">-</span>
                                                    )}
                                                </td>
                                                {/* 월간 구매수 */}
                                                <td className="px-3 py-3 text-center text-sm">
                                                    {product.monthlyPurchases ? (
                                                        <span className="inline-flex items-center gap-1 text-green-400">
                                                            <Users className="w-3 h-3" />
                                                            {product.monthlyPurchases.toLocaleString()}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-500">-</span>
                                                    )}
                                                </td>
                                                {/* 트렌드 */}
                                                <td className="px-3 py-3 text-center">
                                                    {productScores[product.id] && productScores[product.id].trendScore > 0 ? (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedTrendProduct(product);
                                                                setShowTrendModal(true);
                                                            }}
                                                            className="flex flex-col items-center hover:bg-orange-500/10 rounded-lg px-2 py-1 transition-colors cursor-pointer"
                                                            title="클릭하여 트렌드 상세 보기"
                                                        >
                                                            <span className={`text-sm font-semibold ${
                                                                productScores[product.id].trendDirection === 'rising' ? 'text-green-400' :
                                                                productScores[product.id].trendDirection === 'falling' ? 'text-red-400' :
                                                                'text-gray-400'
                                                            }`}>
                                                                {productScores[product.id].trendDirection === 'rising' ? '↑' :
                                                                 productScores[product.id].trendDirection === 'falling' ? '↓' : '→'}
                                                                {' '}{productScores[product.id].trendScore}점
                                                            </span>
                                                        </button>
                                                    ) : (
                                                        <span className="text-gray-500 text-sm">-</span>
                                                    )}
                                                </td>
                                                {/* 점수 */}
                                                <td className="px-3 py-3 text-center">
                                                    {productScores[product.id] ? (
                                                        <div className="flex flex-col items-center">
                                                            <span className={`text-lg font-bold ${productScores[product.id].gradeColor}`}>
                                                                {productScores[product.id].grade}
                                                            </span>
                                                            <span className="text-xs text-gray-400">
                                                                {productScores[product.id].totalScore}점
                                                            </span>
                                                            {(productScores[product.id].videoPenalty > 0 || productScores[product.id].brandPenalty > 0) && (
                                                                <span className="text-xs text-red-400">
                                                                    {productScores[product.id].videoPenalty > 0 && `제품-${productScores[product.id].penaltyDaysRemaining}일`}
                                                                    {productScores[product.id].videoPenalty > 0 && productScores[product.id].brandPenalty > 0 && ' / '}
                                                                    {productScores[product.id].brandPenalty > 0 && `브랜드-${productScores[product.id].brandPenaltyDaysRemaining}일`}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-500 text-sm">-</span>
                                                    )}
                                                </td>
                                                {/* 브랜드 */}
                                                <td className="px-3 py-3 text-center">
                                                    <span className={`text-xs font-medium px-2 py-1 rounded ${BRAND_COLORS[product.brand || classifyBrand(product.productName)] || 'text-gray-500'}`}>
                                                        {product.brand || classifyBrand(product.productName)}
                                                    </span>
                                                </td>
                                                {/* 영상 생성 */}
                                                <td className="px-3 py-3 text-center">
                                                    {product.videoCompletedAt ? (
                                                        <button
                                                            onClick={() => handleVideoReset(product.id)}
                                                            className="p-2 bg-green-500/20 hover:bg-green-500/30 rounded-lg transition-colors text-green-400"
                                                            title={`영상 생성 완료 (${new Date(product.videoCompletedAt).toLocaleDateString('ko-KR')})\n클릭하면 초기화`}
                                                        >
                                                            <Video className="w-4 h-4" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleVideoComplete(product.id)}
                                                            className="p-2 hover:bg-purple-500/20 rounded-lg transition-colors text-gray-500 hover:text-purple-400"
                                                            title="영상 생성 완료로 표시"
                                                        >
                                                            <Video className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </td>
                                                {/* 그래프 */}
                                                <td className="px-3 py-3 text-center">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedProduct(product);
                                                            setShowPriceHistoryModal(true);
                                                        }}
                                                        className="p-2 hover:bg-blue-500/20 rounded-lg transition-colors text-blue-400"
                                                        title="가격 변동 그래프"
                                                    >
                                                        <BarChart3 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                                {/* 삭제 */}
                                                <td className="px-3 py-3 text-center">
                                                    <button
                                                        onClick={() => handleDelete(product.id)}
                                                        className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-400"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* Price History Modal */}
            {showPriceHistoryModal && selectedProduct && (
                <PriceHistoryModal
                    productId={selectedProduct.id}
                    productName={selectedProduct.productName}
                    currentPrice={selectedProduct.currentPrice}
                    onClose={() => {
                        setShowPriceHistoryModal(false);
                        setSelectedProduct(null);
                    }}
                />
            )}
            {/* Trend Detail Modal */}
            {showTrendModal && selectedTrendProduct && (() => {
                const lineId = getProductLineId(selectedTrendProduct.productName);
                const trend = trendData[lineId];
                if (!trend) return null;
                return (
                    <TrendDetailModal
                        searchKeyword={trend.searchKeyword}
                        trendResult={trend}
                        trendScore={productScores[selectedTrendProduct.id]?.trendScore ?? 0}
                        onClose={() => {
                            setShowTrendModal(false);
                            setSelectedTrendProduct(null);
                        }}
                    />
                );
            })()}
        </div>
    );
}
