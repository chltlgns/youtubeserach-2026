'use client';

import { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, RefreshCw, Trash2, Download, Plus, Zap, Loader2, LogIn, LogOut, User, BarChart3, Star } from 'lucide-react';
import { supabase, CoupangProductDB } from '@/lib/supabase';
import AuthModal from '@/components/auth/AuthModal';
import PriceHistoryModal from '@/components/coupang/PriceHistoryModal';
import { User as SupabaseUser } from '@supabase/supabase-js';

// Types
interface CoupangProduct {
    id: string;
    url: string;
    productName: string;
    currentPrice: number;
    originalPrice: number;
    discountRate: string;
    previousPrice?: number;
    priceChangeRate?: string;
    rating?: number | null;
    reviewCount?: number | null;
    monthlyPurchases?: number | null;
    lastUpdated: string;
}

interface CoupangScrapedData {
    url: string;
    productName: string;
    currentPrice: number;
    originalPrice: number;
    discountRate: string;
}

const RESET_HOUR = 9; // 오전 9시 기준 리셋

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
            }));

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
            setTimeout(() => {
                alert(`✅ 모든 제품(${completeCount}개) 업데이트 완료!`);
            }, 1000);
        }
    }, [loadProducts]);

    // 순차 업데이트 진행 확인 (뒤로 가기로 돌아왔을 때)
    useEffect(() => {
        // 이미 처리중인지 확인
        const processingKey = 'coupang_update_processing';
        if (sessionStorage.getItem(processingKey)) {
            return; // 이미 처리 중
        }

        const queueStr = localStorage.getItem('coupang_update_queue');
        const indexStr = localStorage.getItem('coupang_update_index');

        if (!queueStr || indexStr === null) return;

        const urls = JSON.parse(queueStr) as string[];
        const currentIndex = parseInt(indexStr);

        // 현재 인덱스가 -1이면 아직 시작 안함 (handleAutoUpdate에서 처리)
        if (currentIndex < 0) return;

        // 처리 시작 표시
        sessionStorage.setItem(processingKey, 'true');

        console.log(`[YGIF] 뒤로 가기 감지 - 현재 인덱스: ${currentIndex}, 전체: ${urls.length}`);

        // 현재 제품 완료, 다음으로 이동할지 결정
        const nextIndex = currentIndex + 1;

        if (nextIndex >= urls.length) {
            // 모든 업데이트 완료
            localStorage.removeItem('coupang_update_queue');
            localStorage.removeItem('coupang_update_index');
            sessionStorage.removeItem(processingKey);

            // 완료 알림 설정 (새로고침 후 표시)
            sessionStorage.setItem('coupang_update_complete', urls.length.toString());

            console.log('[YGIF] 모든 업데이트 완료! 페이지 새로고침...');

            // 페이지 새로고침으로 데이터 다시 로드
            window.location.reload();
        } else {
            // 다음 제품으로 이동
            console.log(`[YGIF] 다음 제품으로 이동: ${nextIndex + 1}/${urls.length}`);
            localStorage.setItem('coupang_update_index', nextIndex.toString());
            setUpdateProgress(`업데이트 중: ${nextIndex + 1}/${urls.length}`);
            setIsUpdating(true);

            // 잠시 대기 후 다음 페이지로 이동
            setTimeout(() => {
                sessionStorage.removeItem(processingKey);
                window.location.href = urls[nextIndex];
            }, 1500);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // 빈 의존성 - 마운트 시 한 번만 실행

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

    // Parse input data
    const parseInputData = (input: string): CoupangScrapedData | null => {
        try {
            const data = JSON.parse(input);
            if (data.url && data.productName && typeof data.currentPrice === 'number') {
                return data as CoupangScrapedData;
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

    // Sequential update - uses CustomEvent to communicate with Tampermonkey
    const handleAutoUpdate = async () => {
        if (products.length === 0) {
            alert('업데이트할 제품이 없습니다.');
            return;
        }

        const urls = products.map(p => p.url);

        const confirmed = confirm(
            `${products.length}개 제품을 순차적으로 업데이트합니다.\n\n` +
            `각 제품 페이지를 방문하며 자동으로 데이터가 저장됩니다.\n` +
            `저장 후 자동으로 뒤로 가기 → 다음 제품으로 이동합니다.\n\n` +
            `(Edge + Tampermonkey 필수)\n\n` +
            `시작하시겠습니까?`
        );

        if (!confirmed) return;

        // localStorage에 큐 저장 (YGIF 도메인)
        localStorage.setItem('coupang_update_queue', JSON.stringify(urls));
        localStorage.setItem('coupang_update_index', '0');

        console.log('[YGIF] 순차 업데이트 시작, URL 개수:', urls.length);
        setUpdateProgress(`업데이트 중: 1/${urls.length}`);

        // 첫 번째 제품으로 이동
        window.location.href = urls[0];
    };

    // Continue to next product (called from UI or automatically)
    const handleNextProduct = () => {
        const queueStr = localStorage.getItem('coupang_update_queue');
        const indexStr = localStorage.getItem('coupang_update_index');

        if (!queueStr || !indexStr) {
            alert('업데이트 큐가 없습니다.');
            return;
        }

        const urls = JSON.parse(queueStr);
        const currentIndex = parseInt(indexStr);
        const nextIndex = currentIndex + 1;

        if (nextIndex >= urls.length) {
            // All done
            localStorage.removeItem('coupang_update_queue');
            localStorage.removeItem('coupang_update_index');
            alert(`모든 제품(${urls.length}개) 업데이트 완료!`);
            loadProducts();
            return;
        }

        localStorage.setItem('coupang_update_index', nextIndex.toString());
        setUpdateProgress(`업데이트 중: ${nextIndex + 1}/${urls.length}`);

        // Navigate to next product
        window.location.href = urls[nextIndex];
    };

    // Check if we have pending updates
    const getPendingUpdate = () => {
        const queueStr = localStorage.getItem('coupang_update_queue');
        const indexStr = localStorage.getItem('coupang_update_index');
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
                            <User className="w-4 h-4" />
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
                            {products.length}개 제품 | 마지막 리셋: {lastResetDate || '-'}
                        </div>
                        <div className="flex gap-2 items-center">
                            {updateProgress && (
                                <span className="text-sm text-yellow-400 animate-pulse">
                                    {updateProgress}
                                </span>
                            )}
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
                                        <th className="px-3 py-3 text-left text-sm font-semibold" style={{ maxWidth: '250px' }}>제품명</th>
                                        <th className="px-3 py-3 text-right text-sm font-semibold">현재가격</th>
                                        <th className="px-3 py-3 text-center text-sm font-semibold">할인율</th>
                                        <th className="px-3 py-3 text-center text-sm font-semibold">전일대비</th>
                                        <th className="px-3 py-3 text-center text-sm font-semibold">별점</th>
                                        <th className="px-3 py-3 text-center text-sm font-semibold">리뷰</th>
                                        <th className="px-3 py-3 text-center text-sm font-semibold">그래프</th>
                                        <th className="px-3 py-3 text-center text-sm font-semibold">삭제</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {products.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                                                추적 중인 제품이 없습니다. 위에서 제품을 추가해주세요.
                                            </td>
                                        </tr>
                                    ) : (
                                        products.map((product) => (
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
        </div>
    );
}
