// Brand classification utility for Coupang product price tracker
// Detects brand from Korean product names

export const BRAND_LIST = [
  'Apple',
  '삼성전자',
  'LG전자',
  'HP',
  'ASUS',
  '레노버',
  'MSI',
  'Dell',
  '한성컴퓨터',
  '베이직스',
  '기타',
] as const;

export type Brand = (typeof BRAND_LIST)[number];

export const BRAND_COLORS: Record<string, string> = {
  'Apple': 'text-gray-300',
  '삼성전자': 'text-blue-400',
  'LG전자': 'text-red-400',
  'HP': 'text-cyan-400',
  'ASUS': 'text-teal-400',
  '레노버': 'text-orange-400',
  'MSI': 'text-red-500',
  'Dell': 'text-blue-300',
  '한성컴퓨터': 'text-yellow-400',
  '베이직스': 'text-green-400',
  '기타': 'text-gray-500',
};

const BRAND_PATTERNS: Array<{ brand: Brand; regex: RegExp }> = [
  // Apple - check specific products first
  { brand: 'Apple', regex: /맥북|MacBook|macbook|아이패드|iPad|Apple|애플/i },

  // Samsung
  { brand: '삼성전자', regex: /삼성|Samsung|갤럭시북|Galaxy Book/i },

  // LG - check specific patterns before bare "LG"
  { brand: 'LG전자', regex: /LG전자|LG 그램|LG gram|LG/i },

  // HP
  { brand: 'HP', regex: /\bHP\b|엘리트북|EliteBook|스펙터|Spectre|파빌리온|Pavilion|OMEN|오멘/i },

  // ASUS
  { brand: 'ASUS', regex: /에이수스|ASUS|아수스|ROG|비보북|VivoBook|젠북|ZenBook/i },

  // Lenovo
  { brand: '레노버', regex: /레노버|Lenovo|씽크패드|ThinkPad|아이디어패드|IdeaPad|요가|Yoga/i },

  // MSI
  { brand: 'MSI', regex: /\bMSI\b/i },

  // Dell
  { brand: 'Dell', regex: /\b델\b|Dell|인스피론|Inspiron|\bXPS\b|래티튜드|Latitude/i },

  // Hansung
  { brand: '한성컴퓨터', regex: /한성|TFG|한성컴퓨터/i },

  // Basics
  { brand: '베이직스', regex: /베이직스|Basics/i },
];

/**
 * Classifies a product name into a brand category
 * Returns the first matching brand, or "기타" if no match found
 */
export function classifyBrand(productName: string): Brand {
  for (const { brand, regex } of BRAND_PATTERNS) {
    if (regex.test(productName)) {
      return brand;
    }
  }
  return '기타';
}
