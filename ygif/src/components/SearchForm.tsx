'use client';

import { useState } from 'react';
import { SUPPORTED_COUNTRIES } from '@/lib/constants';
import { Search, Globe, Calendar, TrendingUp, Loader2 } from 'lucide-react';

interface SearchFormProps {
    onSearch: (data: SearchFormData) => void;
    isLoading?: boolean;
}

export interface SearchFormData {
    keyword: string;
    countries: string[];
    maxResults: number;
    order: string;
    publishedAfter?: string;
    publishedBefore?: string;
}

export function SearchForm({ onSearch, isLoading }: SearchFormProps) {
    const [keyword, setKeyword] = useState('');
    const [countries, setCountries] = useState<string[]>(SUPPORTED_COUNTRIES.map((c) => c.code));
    const [maxResults, setMaxResults] = useState(10);
    const [order, setOrder] = useState('relevance');
    const [publishedAfter, setPublishedAfter] = useState('');
    const [publishedBefore, setPublishedBefore] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);

    const toggleCountry = (code: string) => {
        setCountries((prev) =>
            prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
        );
    };

    const selectAllCountries = () => {
        setCountries(SUPPORTED_COUNTRIES.map((c) => c.code));
    };

    const deselectAllCountries = () => {
        setCountries([]);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!keyword.trim() || countries.length === 0) return;
        onSearch({
            keyword: keyword.trim(),
            countries,
            maxResults,
            order,
            publishedAfter: publishedAfter || undefined,
            publishedBefore: publishedBefore || undefined,
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Main Search Input */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="Enter keyword to search (e.g., cooking, gaming, tech review)"
                    className="w-full pl-12 pr-4 py-4 text-lg bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-gray-500"
                />
            </div>

            {/* Country Selection */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-400">
                        <Globe className="w-4 h-4" />
                        <span>Target Countries ({countries.length} selected)</span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={selectAllCountries}
                            className="text-xs text-blue-400 hover:text-blue-300"
                        >
                            Select All
                        </button>
                        <span className="text-gray-600">|</span>
                        <button
                            type="button"
                            onClick={deselectAllCountries}
                            className="text-xs text-gray-400 hover:text-gray-300"
                        >
                            Deselect All
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {SUPPORTED_COUNTRIES.map((country) => {
                        const isSelected = countries.includes(country.code);
                        return (
                            <button
                                key={country.code}
                                type="button"
                                onClick={() => toggleCountry(country.code)}
                                className={`flex flex-col items-center p-3 rounded-xl border transition-all ${isSelected
                                        ? 'bg-blue-500/20 border-blue-500 text-white'
                                        : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/30'
                                    }`}
                            >
                                <span className="text-2xl mb-1">
                                    {getCountryFlag(country.code)}
                                </span>
                                <span className="text-xs font-medium">{country.name}</span>
                                <span className="text-[10px] opacity-60">{country.languageName}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Advanced Options Toggle */}
            <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
            >
                <TrendingUp className="w-4 h-4" />
                {showAdvanced ? 'Hide' : 'Show'} Advanced Options
            </button>

            {/* Advanced Options */}
            {showAdvanced && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-400">Results per country</label>
                        <select
                            value={maxResults}
                            onChange={(e) => setMaxResults(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                        >
                            {[5, 10, 25, 50].map((n) => (
                                <option key={n} value={n}>
                                    {n} videos
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-400">Sort by</label>
                        <select
                            value={order}
                            onChange={(e) => setOrder(e.target.value)}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                        >
                            <option value="relevance">Relevance</option>
                            <option value="date">Upload Date</option>
                            <option value="viewCount">View Count</option>
                            <option value="rating">Rating</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Published After
                        </label>
                        <input
                            type="date"
                            value={publishedAfter}
                            onChange={(e) => setPublishedAfter(e.target.value)}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Published Before
                        </label>
                        <input
                            type="date"
                            value={publishedBefore}
                            onChange={(e) => setPublishedBefore(e.target.value)}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                        />
                    </div>
                </div>
            )}

            {/* Submit Button */}
            <button
                type="submit"
                disabled={!keyword.trim() || countries.length === 0 || isLoading}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed rounded-xl font-semibold text-lg shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all flex items-center justify-center gap-2"
            >
                {isLoading ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Searching...
                    </>
                ) : (
                    <>
                        <Search className="w-5 h-5" />
                        Search YouTube in {countries.length} Countries
                    </>
                )}
            </button>
        </form>
    );
}

function getCountryFlag(code: string): string {
    const flags: Record<string, string> = {
        IR: '🇮🇷',
        PK: '🇵🇰',
        IN: '🇮🇳',
        RU: '🇷🇺',
        VN: '🇻🇳',
        ID: '🇮🇩',
    };
    return flags[code] || '🏳️';
}
