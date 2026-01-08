'use client';

import { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { supabase, PriceHistoryDB } from '@/lib/supabase';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

interface PriceHistoryModalProps {
    productId: string;
    productName: string;
    currentPrice: number;
    onClose: () => void;
}

interface ChartDataPoint {
    date: string;
    price: number;
    formattedDate: string;
}

export default function PriceHistoryModal({
    productId,
    productName,
    currentPrice,
    onClose,
}: PriceHistoryModalProps) {
    const [historyData, setHistoryData] = useState<ChartDataPoint[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadPriceHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productId]);

    const loadPriceHistory = async () => {
        try {
            setIsLoading(true);

            // 6개월 전 날짜 계산
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

            const { data, error: fetchError } = await supabase
                .from('price_history')
                .select('*')
                .eq('product_id', productId)
                .gte('recorded_date', sixMonthsAgo.toISOString().split('T')[0])
                .order('recorded_date', { ascending: true });

            if (fetchError) throw fetchError;

            const chartData: ChartDataPoint[] = (data || []).map((item: PriceHistoryDB) => ({
                date: item.recorded_date,
                price: item.price,
                formattedDate: new Date(item.recorded_date).toLocaleDateString('ko-KR', {
                    month: 'short',
                    day: 'numeric',
                }),
            }));

            // 현재 가격 추가 (오늘 데이터가 없으면)
            const today = new Date().toISOString().split('T')[0];
            if (chartData.length === 0 || chartData[chartData.length - 1].date !== today) {
                chartData.push({
                    date: today,
                    price: currentPrice,
                    formattedDate: new Date(today).toLocaleDateString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                    }),
                });
            }

            setHistoryData(chartData);
        } catch (err) {
            console.error('Error loading price history:', err);
            setError('가격 히스토리를 불러올 수 없습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    // 가격 변동 계산
    const priceChange = historyData.length >= 2
        ? historyData[historyData.length - 1].price - historyData[0].price
        : 0;
    const priceChangePercent = historyData.length >= 2 && historyData[0].price > 0
        ? ((priceChange / historyData[0].price) * 100).toFixed(1)
        : '0';

    // 최저가/최고가
    const minPrice = historyData.length > 0 ? Math.min(...historyData.map(d => d.price)) : currentPrice;
    const maxPrice = historyData.length > 0 ? Math.max(...historyData.map(d => d.price)) : currentPrice;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 rounded-2xl border border-white/10 w-full max-w-3xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-white/10">
                    <div>
                        <h2 className="text-lg font-bold">📈 가격 변동 그래프</h2>
                        <p className="text-sm text-gray-400 truncate max-w-md">
                            {productName.length > 50 ? productName.substring(0, 50) + '...' : productName}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4">
                    {isLoading ? (
                        <div className="h-64 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        </div>
                    ) : error ? (
                        <div className="h-64 flex items-center justify-center text-red-400">
                            {error}
                        </div>
                    ) : (
                        <>
                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="bg-white/5 rounded-xl p-4 text-center">
                                    <p className="text-xs text-gray-400 mb-1">현재가</p>
                                    <p className="text-lg font-bold text-blue-400">
                                        {currentPrice.toLocaleString()}원
                                    </p>
                                </div>
                                <div className="bg-white/5 rounded-xl p-4 text-center">
                                    <p className="text-xs text-gray-400 mb-1">최저가</p>
                                    <p className="text-lg font-bold text-green-400">
                                        {minPrice.toLocaleString()}원
                                    </p>
                                </div>
                                <div className="bg-white/5 rounded-xl p-4 text-center">
                                    <p className="text-xs text-gray-400 mb-1">최고가</p>
                                    <p className="text-lg font-bold text-red-400">
                                        {maxPrice.toLocaleString()}원
                                    </p>
                                </div>
                            </div>

                            {/* Price Change Indicator */}
                            <div className="flex items-center justify-center gap-2 mb-4">
                                {priceChange > 0 ? (
                                    <TrendingUp className="w-5 h-5 text-red-400" />
                                ) : priceChange < 0 ? (
                                    <TrendingDown className="w-5 h-5 text-green-400" />
                                ) : (
                                    <Minus className="w-5 h-5 text-gray-400" />
                                )}
                                <span className={`text-lg font-semibold ${priceChange > 0 ? 'text-red-400' : priceChange < 0 ? 'text-green-400' : 'text-gray-400'
                                    }`}>
                                    {priceChange > 0 ? '+' : ''}{priceChange.toLocaleString()}원 ({priceChange >= 0 ? '+' : ''}{priceChangePercent}%)
                                </span>
                                <span className="text-sm text-gray-500">
                                    (6개월 기준)
                                </span>
                            </div>

                            {/* Chart */}
                            <div className="h-64">
                                {historyData.length > 1 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart
                                            data={historyData}
                                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                            <XAxis
                                                dataKey="formattedDate"
                                                stroke="#888"
                                                tick={{ fill: '#888', fontSize: 12 }}
                                            />
                                            <YAxis
                                                stroke="#888"
                                                tick={{ fill: '#888', fontSize: 12 }}
                                                tickFormatter={(value) => `${(value / 10000).toFixed(0)}만`}
                                                domain={['dataMin - 10000', 'dataMax + 10000']}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: '#1f2937',
                                                    border: '1px solid #374151',
                                                    borderRadius: '8px',
                                                }}
                                                labelStyle={{ color: '#9ca3af' }}
                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                formatter={(value: any) => [`${Number(value).toLocaleString()}원`, '가격']}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="price"
                                                stroke="#3b82f6"
                                                strokeWidth={2}
                                                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                                                activeDot={{ r: 6, fill: '#60a5fa' }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-gray-500">
                                        <div className="text-center">
                                            <p>아직 충분한 가격 데이터가 없습니다.</p>
                                            <p className="text-sm mt-2">매일 업데이트하면 가격 변동을 확인할 수 있어요.</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Data points count */}
                            <p className="text-center text-xs text-gray-500 mt-4">
                                총 {historyData.length}개의 가격 데이터
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
