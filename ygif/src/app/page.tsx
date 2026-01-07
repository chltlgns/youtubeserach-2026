'use client';

import { useState } from 'react';
import axios from 'axios';
import { SearchForm, SearchFormData } from '@/components/SearchForm';
import { TranslationDisplay, TranslationItem } from '@/components/TranslationDisplay';
import { VideoTable } from '@/components/VideoTable';
import { VideoResult } from '@/app/api/search/route';

export default function HomePage() {
  const [translations, setTranslations] = useState<TranslationItem[]>([]);
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  const handleSearch = async (data: SearchFormData) => {
    setError(null);
    setDebugInfo(null);
    setTranslations([]);
    setVideos([]);

    try {
      // Step 1: Translate keyword
      setIsTranslating(true);
      console.log('Translating keyword:', data.keyword);

      const translateResponse = await axios.post('/api/translate', {
        keyword: data.keyword,
        countries: data.countries,
      });

      const translationResults = translateResponse.data.translations;
      console.log('Translation results:', translationResults);
      setTranslations(translationResults);
      setIsTranslating(false);

      if (!translationResults || translationResults.length === 0) {
        setError('번역 결과가 없습니다. Gemini API 키를 확인해주세요.');
        return;
      }

      // Step 2: Search YouTube with translated keywords
      setIsSearching(true);
      console.log('Searching YouTube with translations...');

      const searchResponse = await axios.post('/api/search', {
        translations: translationResults,
        maxResults: data.maxResults,
        order: data.order,
        publishedAfter: data.publishedAfter,
        publishedBefore: data.publishedBefore,
      });

      console.log('Search response:', searchResponse.data);

      const videoResults = searchResponse.data.videos || [];
      const apiErrors = searchResponse.data.errors || [];

      setVideos(videoResults);
      setIsSearching(false);

      if (apiErrors.length > 0) {
        const errorMessages = apiErrors.map((e: { country: string; error: string }) =>
          `${e.country}: ${e.error}`
        ).join('\n');
        setError(`API 오류 발생:\n${errorMessages}`);
      }

      if (videoResults.length === 0 && apiErrors.length === 0) {
        setDebugInfo(`검색 완료되었지만 결과가 없습니다. (total: ${searchResponse.data.total || 0})`);
      }

    } catch (err) {
      console.error('Search error:', err);
      setIsTranslating(false);
      setIsSearching(false);

      if (axios.isAxiosError(err)) {
        const errorMessage = err.response?.data?.error || err.message || 'An error occurred';
        const statusCode = err.response?.status;
        setError(`API 오류 (${statusCode}): ${errorMessage}`);
        console.error('API Error details:', err.response?.data);
      } else {
        setError('예상치 못한 오류가 발생했습니다.');
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          YouTube Global Insight Finder
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto">
          Search YouTube videos across multiple countries with automatic keyword translation.
          Find trending content in Iran, Pakistan, India, Russia, Vietnam, and Indonesia.
        </p>
      </div>

      {/* Search Form */}
      <div className="mb-12">
        <SearchForm onSearch={handleSearch} isLoading={isTranslating || isSearching} />
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
          <p className="font-semibold mb-1">❌ 오류 발생</p>
          <p>{error}</p>
        </div>
      )}

      {/* Debug Info */}
      {debugInfo && (
        <div className="mb-8 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400">
          <p>{debugInfo}</p>
        </div>
      )}

      {/* Translations */}
      {(translations.length > 0 || isTranslating) && (
        <div className="mb-12 animate-fade-in">
          <TranslationDisplay translations={translations} isLoading={isTranslating} />
        </div>
      )}

      {/* Video Results */}
      {(videos.length > 0 || isSearching) && (
        <div className="animate-fade-in">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <span className="text-2xl">🎬</span>
            Video Results ({videos.length}개)
          </h2>
          <VideoTable videos={videos} isLoading={isSearching} />
        </div>
      )}

      {/* Empty State */}
      {!isTranslating && !isSearching && videos.length === 0 && translations.length === 0 && !error && (
        <div className="text-center py-16 text-gray-500">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-lg">Enter a keyword and select countries to start searching</p>
        </div>
      )}
    </div>
  );
}
