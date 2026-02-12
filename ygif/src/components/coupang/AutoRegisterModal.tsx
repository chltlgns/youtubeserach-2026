'use client';

import { useState, useRef, useCallback } from 'react';
import { X, Laptop, Search, Check, AlertCircle, Loader2, ChevronRight } from 'lucide-react';
import { NOTEBOOK_BRANDS, TIER_LABELS } from '@/lib/coupangBrands';

interface AutoRegisterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
}

interface ProgressEvent {
    type: 'progress' | 'brand_start' | 'brand_complete' | 'result' | 'error';
    brand?: string;
    current?: number;
    total?: number;
    message: string;
    data?: {
        success: boolean;
        registered: number;
        skipped: number;
        failed: number;
        details: Array<{
            brand: string;
            registered: Array<{ url: string; productName: string; currentPrice: number }>;
            skipped: string[];
            errors: string[];
        }>;
    };
}

type PricePreset = {
    label: string;
    min?: number;
    max?: number;
};

const PRICE_PRESETS: PricePreset[] = [
    { label: '전체', min: undefined, max: undefined },
    { label: '50만~100만', min: 500000, max: 1000000 },
    { label: '100만~200만', min: 1000000, max: 2000000 },
    { label: '200만~300만', min: 2000000, max: 3000000 },
];

export default function AutoRegisterModal({ isOpen, onClose, onComplete }: AutoRegisterModalProps) {
    const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
    const [batchSize, setBatchSize] = useState(5);
    const [pricePresetIndex, setPricePresetIndex] = useState(0);
    const [customMinPrice, setCustomMinPrice] = useState('');
    const [customMaxPrice, setCustomMaxPrice] = useState('');
    const [useCustomPrice, setUseCustomPrice] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [isDone, setIsDone] = useState(false);
    const [progressMessages, setProgressMessages] = useState<ProgressEvent[]>([]);
    const [result, setResult] = useState<ProgressEvent['data'] | null>(null);
    const eventSourceRef = useRef<AbortController | null>(null);
    const progressRef = useRef<HTMLDivElement>(null);

    const toggleBrand = (brandId: string) => {
        setSelectedBrands(prev =>
            prev.includes(brandId)
                ? prev.filter(id => id !== brandId)
                : [...prev, brandId]
        );
    };

    const selectAllTier = (tier: 1 | 2 | 3) => {
        const tierBrands = NOTEBOOK_BRANDS.filter(b => b.tier === tier).map(b => b.id);
        const allSelected = tierBrands.every(id => selectedBrands.includes(id));

        if (allSelected) {
            setSelectedBrands(prev => prev.filter(id => !tierBrands.includes(id)));
        } else {
            setSelectedBrands(prev => [...new Set([...prev, ...tierBrands])]);
        }
    };

    const selectAll = () => {
        if (selectedBrands.length === NOTEBOOK_BRANDS.length) {
            setSelectedBrands([]);
        } else {
            setSelectedBrands(NOTEBOOK_BRANDS.map(b => b.id));
        }
    };

    const getMinPrice = (): number | undefined => {
        if (useCustomPrice) return customMinPrice ? parseInt(customMinPrice) : undefined;
        return PRICE_PRESETS[pricePresetIndex].min;
    };

    const getMaxPrice = (): number | undefined => {
        if (useCustomPrice) return customMaxPrice ? parseInt(customMaxPrice) : undefined;
        return PRICE_PRESETS[pricePresetIndex].max;
    };

    const handleStart = useCallback(async () => {
        if (selectedBrands.length === 0) return;

        setIsRunning(true);
        setIsDone(false);
        setProgressMessages([]);
        setResult(null);

        const controller = new AbortController();
        eventSourceRef.current = controller;

        try {
            // Get auth token
            const { createClient } = await import('@supabase/supabase-js');
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) {
                setProgressMessages([{ type: 'error', message: '로그인이 필요합니다.' }]);
                setIsRunning(false);
                return;
            }

            const response = await fetch('/api/coupang/auto-register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    brands: selectedBrands,
                    batchSize,
                    minPrice: getMinPrice(),
                    maxPrice: getMaxPrice(),
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) throw new Error('No response body');

            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const event: ProgressEvent = JSON.parse(line.slice(6));
                            setProgressMessages(prev => [...prev, event]);

                            if (event.type === 'result' && event.data) {
                                setResult(event.data);
                                setIsDone(true);
                            }

                            // Auto-scroll progress
                            setTimeout(() => {
                                progressRef.current?.scrollTo({
                                    top: progressRef.current.scrollHeight,
                                    behavior: 'smooth',
                                });
                            }, 100);
                        } catch {
                            // Skip malformed events
                        }
                    }
                }
            }
        } catch (err) {
            if ((err as Error).name !== 'AbortError') {
                setProgressMessages(prev => [
                    ...prev,
                    { type: 'error', message: `오류: ${String(err)}` },
                ]);
            }
        } finally {
            setIsRunning(false);
            eventSourceRef.current = null;
        }
    }, [selectedBrands, batchSize, useCustomPrice, customMinPrice, customMaxPrice, pricePresetIndex]);

    const handleClose = () => {
        if (isRunning) {
            eventSourceRef.current?.abort();
        }
        if (isDone) {
            onComplete();
        }
        setIsRunning(false);
        setIsDone(false);
        setProgressMessages([]);
        setResult(null);
        onClose();
    };

    if (!isOpen) return null;

    const tiers = [1, 2, 3] as const;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <Laptop className="w-5 h-5 text-purple-400" />
                        노트북 자동 등록
                    </h2>
                    <button onClick={handleClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {!isRunning && !isDone ? (
                        <>
                            {/* Brand Selection */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-gray-300">브랜드 선택</h3>
                                    <button
                                        onClick={selectAll}
                                        className="text-xs text-purple-400 hover:text-purple-300"
                                    >
                                        {selectedBrands.length === NOTEBOOK_BRANDS.length ? '전체 해제' : '전체 선택'}
                                    </button>
                                </div>

                                {tiers.map(tier => (
                                    <div key={tier} className="mb-3">
                                        <button
                                            onClick={() => selectAllTier(tier)}
                                            className="text-xs text-gray-500 hover:text-gray-400 mb-1.5 flex items-center gap-1"
                                        >
                                            <ChevronRight className="w-3 h-3" />
                                            {TIER_LABELS[tier]}
                                        </button>
                                        <div className="flex flex-wrap gap-2">
                                            {NOTEBOOK_BRANDS.filter(b => b.tier === tier).map(brand => (
                                                <button
                                                    key={brand.id}
                                                    onClick={() => toggleBrand(brand.id)}
                                                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                                                        selectedBrands.includes(brand.id)
                                                            ? 'bg-purple-600/30 border-purple-500 text-purple-300'
                                                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                                    }`}
                                                >
                                                    {brand.koreanName}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Batch Size */}
                            <div>
                                <h3 className="text-sm font-semibold text-gray-300 mb-2">브랜드당 등록 수량</h3>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="range"
                                        min={1}
                                        max={20}
                                        value={batchSize}
                                        onChange={e => setBatchSize(parseInt(e.target.value))}
                                        className="flex-1 accent-purple-500"
                                    />
                                    <span className="text-lg font-bold text-purple-400 w-10 text-center">{batchSize}</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    총 예상: {selectedBrands.length * batchSize}개 (브랜드 {selectedBrands.length}개 x {batchSize}개)
                                </p>
                            </div>

                            {/* Price Range */}
                            <div>
                                <h3 className="text-sm font-semibold text-gray-300 mb-2">가격 범위</h3>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {PRICE_PRESETS.map((preset, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => { setPricePresetIndex(idx); setUseCustomPrice(false); }}
                                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                                                !useCustomPrice && pricePresetIndex === idx
                                                    ? 'bg-purple-600/30 border-purple-500 text-purple-300'
                                                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                            }`}
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setUseCustomPrice(true)}
                                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                                            useCustomPrice
                                                ? 'bg-purple-600/30 border-purple-500 text-purple-300'
                                                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                        }`}
                                    >
                                        직접 입력
                                    </button>
                                </div>

                                {useCustomPrice && (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            placeholder="최소 (원)"
                                            value={customMinPrice}
                                            onChange={e => setCustomMinPrice(e.target.value)}
                                            className="w-36 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                                        />
                                        <span className="text-gray-500">~</span>
                                        <input
                                            type="number"
                                            placeholder="최대 (원)"
                                            value={customMaxPrice}
                                            onChange={e => setCustomMaxPrice(e.target.value)}
                                            className="w-36 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                                        />
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        /* Progress / Results */
                        <div>
                            <div ref={progressRef} className="space-y-2 max-h-96 overflow-y-auto">
                                {progressMessages.map((msg, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex items-start gap-2 text-sm p-2 rounded-lg ${
                                            msg.type === 'error'
                                                ? 'bg-red-500/10 text-red-400'
                                                : msg.type === 'brand_complete'
                                                ? 'bg-green-500/10 text-green-400'
                                                : msg.type === 'result'
                                                ? 'bg-purple-500/10 text-purple-300'
                                                : 'bg-white/5 text-gray-400'
                                        }`}
                                    >
                                        {msg.type === 'error' ? (
                                            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                        ) : msg.type === 'brand_complete' ? (
                                            <Check className="w-4 h-4 mt-0.5 shrink-0" />
                                        ) : msg.type === 'brand_start' ? (
                                            <Search className="w-4 h-4 mt-0.5 shrink-0 animate-pulse" />
                                        ) : msg.type === 'result' ? (
                                            <Laptop className="w-4 h-4 mt-0.5 shrink-0" />
                                        ) : (
                                            <Loader2 className="w-4 h-4 mt-0.5 shrink-0 animate-spin" />
                                        )}
                                        <span>{msg.message}</span>
                                    </div>
                                ))}

                                {isRunning && (
                                    <div className="flex items-center gap-2 text-sm text-gray-400 p-2">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>처리 중...</span>
                                    </div>
                                )}
                            </div>

                            {/* Result Summary */}
                            {result && (
                                <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
                                    <h4 className="font-semibold mb-2">등록 결과</h4>
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        <div>
                                            <p className="text-2xl font-bold text-green-400">{result.registered}</p>
                                            <p className="text-xs text-gray-500">등록 완료</p>
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold text-yellow-400">{result.skipped}</p>
                                            <p className="text-xs text-gray-500">중복 스킵</p>
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold text-red-400">{result.failed}</p>
                                            <p className="text-xs text-gray-500">실패</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
                    {!isRunning && !isDone ? (
                        <>
                            <button
                                onClick={handleClose}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleStart}
                                disabled={selectedBrands.length === 0}
                                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                <Search className="w-4 h-4" />
                                스크래핑 시작
                            </button>
                        </>
                    ) : isDone ? (
                        <button
                            onClick={handleClose}
                            className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                        >
                            <Check className="w-4 h-4" />
                            확인
                        </button>
                    ) : (
                        <button
                            onClick={() => eventSourceRef.current?.abort()}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm transition-colors"
                        >
                            중지
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
