'use client';

import { useState, useCallback } from 'react';
import { Search, ShoppingCart, ArrowUpDown, ExternalLink, Tag, TrendingDown, Scale } from 'lucide-react';
import Image from 'next/image';
import { PriceCompareResult, PriceCompareItem } from '@/lib/naverShoppingTypes';

type SortDirection = 'asc' | 'desc';

function formatPrice(price: number): string {
    return price.toLocaleString('ko-KR') + '원';
}

function ProductCard({ item }: { item: PriceCompareItem }) {
    return (
        <div className="flex gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
            {item.image ? (
                <div className="w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-white/10">
                    <Image
                        src={item.image}
                        alt={item.title}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                        unoptimized
                    />
                </div>
            ) : (
                <div className="w-16 h-16 flex-shrink-0 rounded-md bg-white/10 flex items-center justify-center">
                    <ShoppingCart className="w-6 h-6 text-gray-500" />
                </div>
            )}
            <div className="flex-1 min-w-0">
                <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:text-blue-300 line-clamp-2 leading-tight flex items-start gap-1 group"
                >
                    <span className="flex-1">{item.title}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
                <p className="text-base font-bold text-white mt-1">{formatPrice(item.price)}</p>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{item.mallName}</span>
                    {item.brand && (
                        <>
                            <span className="text-gray-600">·</span>
                            <span className="text-xs text-gray-500 flex items-center gap-0.5">
                                <Tag className="w-2.5 h-2.5" />
                                {item.brand}
                            </span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function SkeletonCard() {
    return (
        <div className="flex gap-3 p-3 rounded-lg bg-white/5 border border-white/5 animate-pulse">
            <div className="w-16 h-16 flex-shrink-0 rounded-md bg-white/10" />
            <div className="flex-1 space-y-2">
                <div className="h-3 bg-white/10 rounded w-3/4" />
                <div className="h-3 bg-white/10 rounded w-1/2" />
                <div className="h-4 bg-white/10 rounded w-1/3" />
                <div className="h-3 bg-white/10 rounded w-2/5" />
            </div>
        </div>
    );
}

function SummaryCard({
    label,
    item,
    isLowest,
    color,
}: {
    label: string;
    item: PriceCompareItem | null;
    isLowest: boolean;
    color: string;
}) {
    return (
        <div
            className={`relative p-4 rounded-xl border transition-all ${
                isLowest
                    ? 'border-green-500/50 bg-green-500/10 shadow-lg shadow-green-500/10'
                    : 'border-white/10 bg-white/5'
            }`}
        >
            {isLowest && (
                <div className="absolute -top-2.5 left-4">
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-500 text-white flex items-center gap-1">
                        <TrendingDown className="w-3 h-3" />
                        최저가
                    </span>
                </div>
            )}
            <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${color}`} />
                <span className="text-xs font-medium text-gray-400">{label}</span>
            </div>
            {item ? (
                <>
                    <p className="text-xl font-bold text-white">{formatPrice(item.price)}</p>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-1">{item.title}</p>
                </>
            ) : (
                <p className="text-sm text-gray-500 mt-1">결과 없음</p>
            )}
        </div>
    );
}

function PlatformColumn({
    title,
    items,
    color,
    badgeColor,
}: {
    title: string;
    items: PriceCompareItem[];
    color: string;
    badgeColor: string;
}) {
    const [sortDir, setSortDir] = useState<SortDirection>('asc');

    const sorted = [...items].sort((a, b) =>
        sortDir === 'asc' ? a.price - b.price : b.price - a.price
    );

    return (
        <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${badgeColor}`}>
                        {title}
                    </span>
                    <span className="text-xs text-gray-500">{items.length}개</span>
                </div>
                <button
                    onClick={() => setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-white/10"
                >
                    <ArrowUpDown className="w-3 h-3" />
                    {sortDir === 'asc' ? '가격 낮은순' : '가격 높은순'}
                </button>
            </div>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {sorted.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                        {title} 상품이 없습니다
                    </div>
                ) : (
                    sorted.map((item, i) => <ProductCard key={`${item.productId}-${i}`} item={item} />)
                )}
            </div>
        </div>
    );
}

export default function PriceComparePage() {
    const [query, setQuery] = useState('');
    const [result, setResult] = useState<PriceCompareResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [otherSortDir, setOtherSortDir] = useState<SortDirection>('asc');

    const handleSearch = useCallback(async () => {
        const q = query.trim();
        if (!q) return;

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const res = await fetch(`/api/naver-shopping/search?q=${encodeURIComponent(q)}&display=100&sort=sim`);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                if (res.status === 503 || data?.error?.includes('API 키')) {
                    setError('네이버 쇼핑 API 키가 설정되지 않았습니다. 환경변수를 확인하세요.');
                } else {
                    setError(data?.error || `검색 실패 (${res.status})`);
                }
                return;
            }
            const data: PriceCompareResult = await res.json();
            setResult(data);
        } catch {
            setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
        } finally {
            setLoading(false);
        }
    }, [query]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSearch();
    };

    const lowestPlatform = (() => {
        if (!result?.lowestPrice) return null;
        return result.lowestPrice.platform;
    })();

    const otherSorted = result
        ? [...result.otherItems].sort((a, b) =>
              otherSortDir === 'asc' ? a.price - b.price : b.price - a.price
          )
        : [];

    return (
        <div className="min-h-screen text-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Scale className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">가격 비교</h1>
                            <p className="text-sm text-gray-400">쿠팡 vs 11번가 실시간 가격 비교</p>
                        </div>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="flex gap-3 mb-8">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="상품명을 입력하세요 (예: 아이폰 16, 삼성 갤럭시)"
                            className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/10 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/15 transition-all text-sm"
                        />
                    </div>
                    <button
                        onClick={handleSearch}
                        disabled={loading || !query.trim()}
                        className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20"
                    >
                        <Search className="w-4 h-4" />
                        검색
                    </button>
                </div>

                {/* Error State */}
                {error && (
                    <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {/* Loading State */}
                {loading && (
                    <div>
                        {/* Summary skeleton */}
                        <div className="grid grid-cols-3 gap-4 mb-8">
                            {[0, 1, 2].map(i => (
                                <div key={i} className="p-4 rounded-xl border border-white/10 bg-white/5 animate-pulse">
                                    <div className="h-3 bg-white/10 rounded w-1/2 mb-3" />
                                    <div className="h-6 bg-white/10 rounded w-2/3 mb-2" />
                                    <div className="h-3 bg-white/10 rounded w-3/4" />
                                </div>
                            ))}
                        </div>
                        {/* Column skeletons */}
                        <div className="flex gap-6">
                            {[0, 1].map(col => (
                                <div key={col} className="flex-1 space-y-2">
                                    <div className="h-8 bg-white/10 rounded-lg w-1/3 mb-3 animate-pulse" />
                                    {[0, 1, 2, 3, 4].map(i => (
                                        <SkeletonCard key={i} />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Results */}
                {result && !loading && (
                    <div>
                        {/* Summary Cards */}
                        <div className="grid grid-cols-3 gap-4 mb-8">
                            <SummaryCard
                                label="전체 최저가"
                                item={result.lowestPrice}
                                isLowest={true}
                                color="bg-green-400"
                            />
                            <SummaryCard
                                label="쿠팡 최저가"
                                item={result.coupangLowest}
                                isLowest={lowestPlatform === 'coupang'}
                                color="bg-orange-400"
                            />
                            <SummaryCard
                                label="11번가 최저가"
                                item={result.elevenStLowest}
                                isLowest={lowestPlatform === '11st'}
                                color="bg-red-400"
                            />
                        </div>

                        {/* Total count */}
                        <p className="text-xs text-gray-500 mb-4">
                            총 {result.total.toLocaleString()}개 검색 결과 중 {result.items.length}개 표시
                            &nbsp;·&nbsp; 쿠팡 {result.coupangItems.length}개, 11번가 {result.elevenStItems.length}개, 기타 {result.otherItems.length}개
                        </p>

                        {/* Two Columns */}
                        <div className="flex gap-6 mb-8">
                            <PlatformColumn
                                title="쿠팡"
                                items={result.coupangItems}
                                color="text-orange-400"
                                badgeColor="bg-orange-500/20 text-orange-300"
                            />
                            <div className="w-px bg-white/10 flex-shrink-0" />
                            <PlatformColumn
                                title="11번가"
                                items={result.elevenStItems}
                                color="text-red-400"
                                badgeColor="bg-red-500/20 text-red-300"
                            />
                        </div>

                        {/* Other Stores */}
                        {result.otherItems.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                                        <ShoppingCart className="w-4 h-4 text-gray-500" />
                                        기타 쇼핑몰
                                        <span className="text-gray-500 font-normal">{result.otherItems.length}개</span>
                                    </h2>
                                    <button
                                        onClick={() => setOtherSortDir(d => (d === 'asc' ? 'desc' : 'asc'))}
                                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-white/10"
                                    >
                                        <ArrowUpDown className="w-3 h-3" />
                                        {otherSortDir === 'asc' ? '가격 낮은순' : '가격 높은순'}
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {otherSorted.map((item, i) => (
                                        <ProductCard key={`other-${item.productId}-${i}`} item={item} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Empty State */}
                {!result && !loading && !error && (
                    <div className="text-center py-24 text-gray-500">
                        <Scale className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p className="text-lg font-medium text-gray-400">상품을 검색해보세요</p>
                        <p className="text-sm mt-1">쿠팡과 11번가의 가격을 한눈에 비교합니다</p>
                    </div>
                )}
            </div>
        </div>
    );
}
