'use client';

interface TranslationDisplayProps {
    translations: TranslationItem[];
    isLoading?: boolean;
}

export interface TranslationItem {
    original_query: string;
    translated_query: string;
    search_synonyms: string[];
    confidence_score: number;
    country_code: string;
    language_code: string;
    language_name: string;
}

const countryFlags: Record<string, string> = {
    IR: '🇮🇷',
    PK: '🇵🇰',
    IN: '🇮🇳',
    RU: '🇷🇺',
    VN: '🇻🇳',
    ID: '🇮🇩',
};

export function TranslationDisplay({ translations, isLoading }: TranslationDisplayProps) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                        key={i}
                        className="p-4 rounded-xl bg-white/5 border border-white/10 animate-pulse"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 bg-white/10 rounded-full" />
                            <div className="h-4 bg-white/10 rounded w-24" />
                        </div>
                        <div className="h-6 bg-white/10 rounded mb-2" />
                        <div className="h-4 bg-white/10 rounded w-1/2" />
                    </div>
                ))}
            </div>
        );
    }

    if (translations.length === 0) {
        return null;
    }

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
                <span className="text-2xl">🌍</span>
                Translated Keywords
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {translations.map((translation) => (
                    <div
                        key={translation.country_code}
                        className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">
                                    {countryFlags[translation.country_code] || '🏳️'}
                                </span>
                                <span className="text-sm font-medium">{translation.language_name}</span>
                            </div>
                            <span
                                className={`text-xs px-2 py-1 rounded-full ${translation.confidence_score >= 0.9
                                        ? 'bg-green-500/20 text-green-400'
                                        : translation.confidence_score >= 0.7
                                            ? 'bg-yellow-500/20 text-yellow-400'
                                            : 'bg-red-500/20 text-red-400'
                                    }`}
                            >
                                {Math.round(translation.confidence_score * 100)}%
                            </span>
                        </div>
                        <p className="text-lg font-semibold mb-2">{translation.translated_query}</p>
                        {translation.search_synonyms.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {translation.search_synonyms.slice(0, 3).map((syn, i) => (
                                    <span
                                        key={i}
                                        className="text-xs px-2 py-1 bg-white/10 rounded-full text-gray-300"
                                    >
                                        {syn}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
