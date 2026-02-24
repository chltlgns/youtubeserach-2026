'use client';

import { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { TrendResult } from '@/lib/trendTypes';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { supabase } from '@/lib/supabase';

interface RelatedQuery {
    query: string;
    value: number;
    change: string;
}

interface TrendDetailModalProps {
    searchKeyword: string;
    trendResult: TrendResult;
    trendScore: number;
    onClose: () => void;
}

export default function TrendDetailModal({
    searchKeyword,
    trendResult,
    trendScore,
    onClose,
}: TrendDetailModalProps) {
    const [relatedTop, setRelatedTop] = useState<RelatedQuery[]>([]);
    const [relatedRising, setRelatedRising] = useState<RelatedQuery[]>([]);
    const [isLoadingRelated, setIsLoadingRelated] = useState(true);

    useEffect(() => {
        fetchRelated();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchKeyword]);

    const fetchRelated = async () => {
        try {
            setIsLoadingRelated(true);
            const { data: { session } } = await supabase.auth.getSession();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }

            const response = await fetch('/api/trends/related', {
                method: 'POST',
                headers,
                body: JSON.stringify({ searchKeyword }),
            });

            const data = await response.json();
            if (data.success) {
                setRelatedTop(data.top || []);
                setRelatedRising(data.rising || []);
            }
        } catch (error) {
            console.error('Error fetching related queries:', error);
        } finally {
            setIsLoadingRelated(false);
        }
    };

    const directionIcon = trendResult.trendDirection === 'rising'
        ? <TrendingUp className="w-5 h-5 text-green-400" />
        : trendResult.trendDirection === 'falling'
            ? <TrendingDown className="w-5 h-5 text-red-400" />
            : <Minus className="w-5 h-5 text-gray-400" />;

    const directionText = trendResult.trendDirection === 'rising' ? '상승'
        : trendResult.trendDirection === 'falling' ? '하락' : '보합';

    const directionColor = trendResult.trendDirection === 'rising' ? 'text-green-400'
        : trendResult.trendDirection === 'falling' ? 'text-red-400' : 'text-gray-400';

    // Prepare chart data
    const chartData = trendResult.dataPoints.map(dp => ({
        date: dp.date,
        value: dp.value,
        formattedDate: dp.date,
    }));

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 rounded-2xl border border-white/10 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-white/10">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-orange-400" />
                            트렌드 상세 - &quot;{searchKeyword}&quot;
                        </h2>
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
                    {/* Stats - 3 column grid */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-white/5 rounded-xl p-4 text-center">
                            <p className="text-xs text-gray-400 mb-1">검색량</p>
                            <p className="text-lg font-bold text-blue-400">
                                {trendResult.currentValue}
                            </p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-4 text-center">
                            <p className="text-xs text-gray-400 mb-1">방향</p>
                            <div className="flex items-center justify-center gap-1">
                                {directionIcon}
                                <p className={`text-lg font-bold ${directionColor}`}>
                                    {directionText}
                                </p>
                            </div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-4 text-center">
                            <p className="text-xs text-gray-400 mb-1">트렌드 점수</p>
                            <p className="text-lg font-bold text-orange-400">
                                {trendScore}점
                            </p>
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="h-64 mb-6">
                        {chartData.length > 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                    data={chartData}
                                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                    <XAxis
                                        dataKey="formattedDate"
                                        stroke="#888"
                                        tick={{ fill: '#888', fontSize: 11 }}
                                        interval="preserveStartEnd"
                                    />
                                    <YAxis
                                        stroke="#888"
                                        tick={{ fill: '#888', fontSize: 12 }}
                                        domain={[0, 100]}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#1f2937',
                                            border: '1px solid #374151',
                                            borderRadius: '8px',
                                        }}
                                        labelStyle={{ color: '#9ca3af' }}
                                        formatter={(value: number | undefined) => [`${value ?? 0}`, '관심도']}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="value"
                                        stroke="#f97316"
                                        strokeWidth={2}
                                        dot={{ fill: '#f97316', strokeWidth: 2, r: 3 }}
                                        activeDot={{ r: 5, fill: '#fb923c' }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-500">
                                <p>트렌드 데이터가 부족합니다.</p>
                            </div>
                        )}
                    </div>

                    {/* Related Queries - 2 column */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Top queries */}
                        <div className="bg-white/5 rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-gray-300 mb-3">상위 검색어</h3>
                            {isLoadingRelated ? (
                                <div className="flex items-center justify-center py-4">
                                    <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                                </div>
                            ) : relatedTop.length > 0 ? (
                                <ul className="space-y-2">
                                    {relatedTop.map((item, idx) => (
                                        <li key={idx} className="flex justify-between items-center text-sm">
                                            <span className="text-gray-300 truncate mr-2">
                                                {idx + 1}. {item.query}
                                            </span>
                                            <span className="text-blue-400 font-medium whitespace-nowrap">
                                                {item.value}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-gray-500 text-center py-4">데이터 없음</p>
                            )}
                        </div>

                        {/* Rising queries */}
                        <div className="bg-white/5 rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-gray-300 mb-3">급상승 검색어</h3>
                            {isLoadingRelated ? (
                                <div className="flex items-center justify-center py-4">
                                    <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                                </div>
                            ) : relatedRising.length > 0 ? (
                                <ul className="space-y-2">
                                    {relatedRising.map((item, idx) => (
                                        <li key={idx} className="flex justify-between items-center text-sm">
                                            <span className="text-gray-300 truncate mr-2">
                                                {idx + 1}. {item.query}
                                            </span>
                                            <span className="text-green-400 font-medium whitespace-nowrap">
                                                {item.change || '급등'}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-gray-500 text-center py-4">데이터 없음</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
