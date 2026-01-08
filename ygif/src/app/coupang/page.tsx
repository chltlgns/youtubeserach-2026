'use client';

import { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, RefreshCw, Trash2, Download, Plus, Zap, Loader2 } from 'lucide-react';
import {
    CoupangProduct,
    CoupangState,
    CoupangScrapedData,
    COUPANG_STORAGE_KEY,
    RESET_HOUR
} from '@/lib/coupangTypes';

export default function CoupangPage() {
    const [products, setProducts] = useState<CoupangProduct[]>([]);
    const [lastResetDate, setLastResetDate] = useState<string>('');
    const [inputData, setInputData] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateProgress, setUpdateProgress] = useState('');

    // Load data from localStorage
    useEffect(() => {
        const loadData = () => {
            try {
                const stored = localStorage.getItem(COUPANG_STORAGE_KEY);
                if (stored) {
                    const state: CoupangState = JSON.parse(stored);
                    setProducts(state.products);
                    setLastResetDate(state.lastResetDate);

                    // Check if reset is needed
                    checkAndReset(state);
                }
            } catch (e) {
                console.error('Failed to load data:', e);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    // Save to localStorage whenever products change
    useEffect(() => {
        if (!isLoading) {
            const state: CoupangState = {
                products,
                lastResetDate: lastResetDate || new Date().toISOString().split('T')[0],
            };
            localStorage.setItem(COUPANG_STORAGE_KEY, JSON.stringify(state));
        }
    }, [products, lastResetDate, isLoading]);

    // Check if we need to reset (9 AM daily)
    const checkAndReset = (state: CoupangState) => {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const currentHour = now.getHours();

        // If it's past 9 AM and we haven't reset today
        if (currentHour >= RESET_HOUR && state.lastResetDate !== today) {
            // Move current prices to previous prices
            const updatedProducts = state.products.map(p => ({
                ...p,
                previousPrice: p.currentPrice,
                priceChangeRate: undefined, // Will be recalculated on next update
            }));
            setProducts(updatedProducts);
            setLastResetDate(today);
        }
    };

    // Calculate price change rate
    const calculatePriceChange = (current: number, previous?: number): string => {
        if (!previous) return '-';
        const change = ((current - previous) / previous) * 100;
        const sign = change > 0 ? '+' : '';
        return `${sign}${change.toFixed(1)}%`;
    };

    // Handle paste data from bookmarklet
    const handleAddProduct = useCallback(() => {
        try {
            const data: CoupangScrapedData = JSON.parse(inputData);

            // Check if product already exists
            const existingIndex = products.findIndex(p => p.url === data.url);

            const newProduct: CoupangProduct = {
                id: existingIndex >= 0 ? products[existingIndex].id : Date.now().toString(),
                url: data.url,
                productName: data.productName,
                currentPrice: data.currentPrice,
                originalPrice: data.originalPrice,
                discountRate: data.discountRate,
                previousPrice: existingIndex >= 0 ? products[existingIndex].currentPrice : undefined,
                priceChangeRate: existingIndex >= 0
                    ? calculatePriceChange(data.currentPrice, products[existingIndex].currentPrice)
                    : undefined,
                lastUpdated: new Date().toISOString(),
                dateAdded: existingIndex >= 0 ? products[existingIndex].dateAdded : new Date().toISOString(),
            };

            if (existingIndex >= 0) {
                // Update existing product
                const updated = [...products];
                updated[existingIndex] = newProduct;
                setProducts(updated);
            } else {
                // Add new product
                setProducts([...products, newProduct]);
            }

            setInputData('');
            alert('제품이 추가/업데이트되었습니다!');
        } catch (e) {
            alert('데이터 형식이 올바르지 않습니다. 쿠팡 페이지에서 스크립트를 실행해주세요.');
        }
    }, [inputData, products]);

    // Delete product
    const handleDelete = (id: string) => {
        if (confirm('이 제품을 삭제하시겠습니까?')) {
            setProducts(products.filter(p => p.id !== id));
        }
    };

    // Reset all data
    const handleResetAll = () => {
        if (confirm('모든 데이터를 초기화하시겠습니까?')) {
            setProducts([]);
            setLastResetDate(new Date().toISOString().split('T')[0]);
        }
    };

    // Auto update all products using Puppeteer
    const handleAutoUpdate = async () => {
        if (products.length === 0) {
            alert('업데이트할 제품이 없습니다.');
            return;
        }

        if (!confirm(`${products.length}개의 제품 가격을 자동으로 업데이트하시겠습니까?\n(약 ${Math.ceil(products.length * 4 / 60)}분 소요)`)) {
            return;
        }

        setIsUpdating(true);
        setUpdateProgress('스크래핑 시작...');

        try {
            const urls = products.map(p => p.url);

            const response = await fetch('/api/coupang/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urls }),
            });

            if (!response.ok) {
                throw new Error('스크래핑 API 호출 실패');
            }

            const data = await response.json();

            if (data.success && data.results) {
                // Update products with new data
                const updatedProducts = products.map(product => {
                    const result = data.results.find((r: { url: string; success: boolean; productName: string; currentPrice: number; originalPrice: number; discountRate: string }) => r.url === product.url);
                    if (result && result.success) {
                        return {
                            ...product,
                            previousPrice: product.currentPrice,
                            currentPrice: result.currentPrice,
                            originalPrice: result.originalPrice,
                            discountRate: result.discountRate,
                            priceChangeRate: calculatePriceChange(result.currentPrice, product.currentPrice),
                            lastUpdated: new Date().toISOString(),
                        };
                    }
                    return product;
                });

                setProducts(updatedProducts);
                setUpdateProgress(`완료! ${data.processed - data.failed}개 성공, ${data.failed}개 실패`);

                setTimeout(() => {
                    setUpdateProgress('');
                    alert(`업데이트 완료!\n성공: ${data.processed - data.failed}개\n실패: ${data.failed}개`);
                }, 1000);
            }
        } catch (error) {
            console.error('Auto update error:', error);
            setUpdateProgress('업데이트 실패');
            alert('자동 업데이트에 실패했습니다. 콘솔을 확인해주세요.');
        } finally {
            setIsUpdating(false);
        }
    };

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
            p.lastUpdated,
        ]);

        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `coupang_prices_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Format price with commas
    const formatPrice = (price: number) => {
        return price.toLocaleString('ko-KR') + '원';
    };

    // Get price change color
    const getPriceChangeColor = (rate?: string) => {
        if (!rate || rate === '-') return 'text-gray-400';
        if (rate.startsWith('+')) return 'text-red-400';
        if (rate.startsWith('-')) return 'text-blue-400';
        return 'text-gray-400';
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="text-center mb-8">
                <h1 className="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-orange-400 via-red-400 to-pink-400 bg-clip-text text-transparent flex items-center justify-center gap-3">
                    <ShoppingCart className="w-10 h-10 text-orange-400" />
                    Coupang Price Tracker
                </h1>
                <p className="text-gray-400">
                    쿠팡 제품 가격을 추적하고 변동율을 확인하세요
                </p>
            </div>

            {/* Input Section */}
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10 mb-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    제품 추가/업데이트
                </h3>
                <div className="flex gap-3">
                    <textarea
                        value={inputData}
                        onChange={(e) => setInputData(e.target.value)}
                        placeholder="쿠팡 페이지에서 스크립트 실행 후 복사된 데이터를 붙여넣기 (Ctrl+V)"
                        className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-500 resize-none h-20"
                    />
                    <button
                        onClick={handleAddProduct}
                        disabled={!inputData.trim()}
                        className="px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        추가
                    </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    💡 쿠팡 제품 페이지에서 F12 → Console에 스크립트를 실행하면 데이터가 자동으로 복사됩니다
                </p>
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
                                <th className="px-4 py-3 text-left text-sm font-semibold">제품명</th>
                                <th className="px-4 py-3 text-right text-sm font-semibold">현재가격</th>
                                <th className="px-4 py-3 text-right text-sm font-semibold">원래가격</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold">할인율</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold">전일대비</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold">작업</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                                        추적 중인 제품이 없습니다. 위에서 제품을 추가해주세요.
                                    </td>
                                </tr>
                            ) : (
                                products.map((product) => (
                                    <tr key={product.id} className="border-b border-white/5 hover:bg-white/5">
                                        <td className="px-4 py-3">
                                            <a
                                                href={product.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-400 hover:underline line-clamp-2"
                                            >
                                                {product.productName}
                                            </a>
                                            <p className="text-xs text-gray-500 mt-1">
                                                업데이트: {new Date(product.lastUpdated).toLocaleString('ko-KR')}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-red-400">
                                            {formatPrice(product.currentPrice)}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-400 line-through">
                                            {formatPrice(product.originalPrice)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-sm">
                                                {product.discountRate}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-3 text-center font-semibold ${getPriceChangeColor(product.priceChangeRate)}`}>
                                            {product.priceChangeRate || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
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

            {/* Bookmarklet Guide */}
            <div className="mt-8 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-2xl p-6 border border-orange-500/20">
                <h3 className="text-lg font-semibold mb-4">📋 사용 방법</h3>
                <ol className="space-y-2 text-sm text-gray-300">
                    <li>1. 쿠팡 제품 페이지를 엽니다</li>
                    <li>2. F12를 눌러 개발자 도구를 엽니다</li>
                    <li>3. Console 탭에서 <code className="text-yellow-400">allow pasting</code> 입력 후 Enter</li>
                    <li>4. 아래 스크립트를 붙여넣고 Enter</li>
                    <li>5. 나타난 창의 텍스트를 Ctrl+A로 전체선택 → Ctrl+C로 복사</li>
                    <li>6. 이 페이지 입력창에 붙여넣기</li>
                </ol>
                <div className="mt-4 p-4 bg-black/30 rounded-xl overflow-x-auto">
                    <code className="text-xs text-green-400 whitespace-pre">
                        {`(function(){
  var n = document.querySelector('h1.product-title span.twc-font-bold, h1.product-title, .prod-buy-header__title');
  var name = n ? n.textContent.trim() : document.title.split(' - ')[0];
  var p = document.querySelector('.final-price-amount, .price-amount.final-price-amount');
  var price = p ? p.textContent.replace(/[^0-9]/g,'') : '0';
  var allPrices = document.querySelectorAll('.price-amount');
  var original = price;
  allPrices.forEach(function(el){ 
    var t = el.textContent.replace(/[^0-9]/g,'');
    if(parseInt(t) > parseInt(original)) original = t;
  });
  var discount = '0%';
  if(parseInt(original) > parseInt(price)){
    discount = Math.round((1 - parseInt(price)/parseInt(original)) * 100) + '%';
  }
  var data = JSON.stringify({url:location.href, productName:name, currentPrice:parseInt(price)||0, originalPrice:parseInt(original)||0, discountRate:discount});
  prompt('Ctrl+A 전체선택 후 Ctrl+C 복사:', data);
})();`}
                    </code>
                </div>
                <p className="mt-3 text-xs text-gray-500">
                    ⚠️ 데이터가 0으로 나오면 페이지를 완전히 로딩한 후 다시 시도해주세요
                </p>
            </div>
        </div>
    );
}
