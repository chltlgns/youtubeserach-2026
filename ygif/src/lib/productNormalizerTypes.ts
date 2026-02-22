// AI Product Normalizer Types

export interface NormalizedProduct {
  brand: string;              // "Apple", "삼성"
  product_line: string;       // "맥미니 M4 Pro", "갤럭시북5 프로 16"
  generation: string | null;  // "M3", "울트라5", null
  year: string | null;        // "2025", null
  trend_keywords: string[];   // ["맥미니 M3", "맥미니 2025", "Mac Mini M3"]
  category: string;           // "노트북" | "데스크탑" | "태블릿" | "모니터" | "액세서리" | "기타"
  confidence: number;         // 0.0-1.0
}

export interface NormalizationResult {
  originalName: string;
  normalized: NormalizedProduct;
  lineId: string;             // Computed: brand-productline-generation hash
  source: 'ai' | 'cache' | 'regex-fallback';
}

export interface NormalizationBatchResponse {
  success: boolean;
  results: NormalizationResult[];
  fromCache: number;
  fromAI: number;
  fromFallback: number;
  errors: string[];
}
