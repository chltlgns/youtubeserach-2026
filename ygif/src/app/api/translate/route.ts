import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { SUPPORTED_COUNTRIES } from '@/lib/constants';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface TranslationResult {
    original_query: string;
    translated_query: string;
    search_synonyms: string[];
    confidence_score: number;
    country_code: string;
    language_code: string;
    language_name: string;
}

export async function POST(request: NextRequest) {
    try {
        const { keyword, countries } = await request.json();

        if (!keyword || typeof keyword !== 'string') {
            return NextResponse.json(
                { error: 'Keyword is required' },
                { status: 400 }
            );
        }

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json(
                { error: 'Gemini API key not configured' },
                { status: 500 }
            );
        }

        const selectedCountries = countries?.length
            ? SUPPORTED_COUNTRIES.filter((c) => countries.includes(c.code))
            : SUPPORTED_COUNTRIES;

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const translations: TranslationResult[] = [];

        for (const country of selectedCountries) {
            const prompt = `You are a professional translator specializing in YouTube search optimization.

Translate the following keyword for YouTube search in ${country.name} (${country.languageName}):

Keyword: "${keyword}"

Requirements:
1. Provide the most natural and search-friendly translation in ${country.languageName}
2. Include 3-5 synonyms or alternative search terms commonly used on YouTube
3. Consider local slang, colloquial expressions, and popular search patterns
4. For non-Latin scripts (Hindi/Urdu/Persian/Russian), ensure proper script usage

Respond in this exact JSON format only, no other text:
{
  "translated_query": "translated keyword here",
  "search_synonyms": ["synonym1", "synonym2", "synonym3"],
  "confidence_score": 0.95
}`;

            try {
                const result = await model.generateContent(prompt);
                const response = result.response;
                const text = response.text();

                // Parse JSON from response
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    translations.push({
                        original_query: keyword,
                        translated_query: parsed.translated_query,
                        search_synonyms: parsed.search_synonyms || [],
                        confidence_score: parsed.confidence_score || 0.9,
                        country_code: country.code,
                        language_code: country.language,
                        language_name: country.languageName,
                    });
                }
            } catch (error) {
                console.error(`Translation error for ${country.name}:`, error);
                // Add fallback with original keyword
                translations.push({
                    original_query: keyword,
                    translated_query: keyword,
                    search_synonyms: [],
                    confidence_score: 0,
                    country_code: country.code,
                    language_code: country.language,
                    language_name: country.languageName,
                });
            }
        }

        return NextResponse.json({ translations });
    } catch (error) {
        console.error('Translation API error:', error);
        return NextResponse.json(
            { error: 'Failed to translate keyword' },
            { status: 500 }
        );
    }
}
