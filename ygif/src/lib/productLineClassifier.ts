// Product Line Classifier
// 제품명에서 브랜드 + 제품 라인을 추출하여 Google Trends 검색 키워드로 변환

import { ProductLine } from './trendTypes';

interface LinePattern {
    lineId: string;        // base ID: "samsung-galaxybook"
    baseName: string;      // "갤럭시북"
    baseKeyword: string;   // "갤럭시북"
    regex: RegExp;         // 제품라인 감지
    genRegex?: RegExp;     // 세대 추출 (e.g., /갤럭시\s*북\s*(\d)/i → "4")
    chipRegex?: RegExp;    // 칩셋 추출 (e.g., /M(\d)/i → "M4") - Apple용
    subLines?: Array<{ name: string; keyword: string; regex: RegExp }>;
    category?: string;
}

interface BrandLineConfig {
    brand: string;
    lines: LinePattern[];
    fallback: { lineId: string; baseName: string; baseKeyword: string; category?: string };
}

const BRAND_LINE_CONFIGS: BrandLineConfig[] = [
    {
        brand: 'Apple',
        lines: [
            {
                lineId: 'apple-macbook-pro',
                baseName: 'MacBook Pro',
                baseKeyword: '맥북프로',
                regex: /맥북\s*프로|MacBook\s*Pro/i,
                chipRegex: /M(\d)/i,
            },
            {
                lineId: 'apple-macbook-air',
                baseName: 'MacBook Air',
                baseKeyword: '맥북에어',
                regex: /맥북\s*에어|MacBook\s*Air/i,
                chipRegex: /M(\d)/i,
            },
            {
                lineId: 'apple-macmini',
                baseName: 'Mac mini',
                baseKeyword: '맥미니',
                regex: /맥\s*미니|Mac\s*mini/i,
                chipRegex: /M(\d)/i,
                category: '데스크탑',
            },
            {
                lineId: 'apple-macstudio',
                baseName: 'Mac Studio',
                baseKeyword: '맥스튜디오',
                regex: /맥\s*스튜디오|Mac\s*Studio/i,
                chipRegex: /M(\d)/i,
                category: '데스크탑',
            },
            {
                lineId: 'apple-ipad',
                baseName: 'iPad',
                baseKeyword: '아이패드',
                regex: /아이패드|iPad/i,
                chipRegex: /M(\d)/i,
                category: '태블릿',
                subLines: [
                    { name: 'Pro', keyword: '프로', regex: /프로|Pro/i },
                    { name: 'Air', keyword: '에어', regex: /에어|Air/i },
                    { name: 'mini', keyword: '미니', regex: /미니|mini/i },
                ],
            },
        ],
        fallback: { lineId: 'apple', baseName: 'Apple', baseKeyword: 'Apple' },
    },
    {
        brand: '삼성전자',
        lines: [
            {
                lineId: 'samsung-galaxybook',
                baseName: '갤럭시북',
                baseKeyword: '갤럭시북',
                regex: /갤럭시\s*북|Galaxy\s*Book/i,
                genRegex: /갤럭시\s*북\s*(\d)|Galaxy\s*Book\s*(\d)/i,
                subLines: [
                    { name: '울트라', keyword: '울트라', regex: /울트라|Ultra/i },
                    { name: '프로', keyword: '프로', regex: /프로|Pro/i },
                    { name: '360', keyword: '360', regex: /360/i },
                    { name: '엣지', keyword: '엣지', regex: /엣지|Edge/i },
                ],
            },
        ],
        fallback: { lineId: 'samsung-laptop', baseName: '삼성 노트북', baseKeyword: '삼성 노트북' },
    },
    {
        brand: 'LG전자',
        lines: [
            {
                lineId: 'lg-gram',
                baseName: 'LG 그램',
                baseKeyword: 'LG 그램',
                regex: /그램|gram/i,
                subLines: [
                    { name: '프로', keyword: '프로', regex: /프로|Pro/i },
                    { name: 'Pro AI', keyword: 'Pro AI', regex: /Pro\s*AI/i },
                ],
            },
        ],
        fallback: { lineId: 'lg-laptop', baseName: 'LG 노트북', baseKeyword: 'LG 노트북' },
    },
    {
        brand: 'HP',
        lines: [
            { lineId: 'hp-omen', baseName: 'HP OMEN', baseKeyword: 'HP OMEN', regex: /OMEN|오멘/i },
            { lineId: 'hp-spectre', baseName: 'HP Spectre', baseKeyword: 'HP 스펙터', regex: /Spectre|스펙터/i },
            { lineId: 'hp-pavilion', baseName: 'HP Pavilion', baseKeyword: 'HP 파빌리온', regex: /Pavilion|파빌리온/i },
            { lineId: 'hp-elitebook', baseName: 'HP EliteBook', baseKeyword: 'HP 엘리트북', regex: /EliteBook|엘리트북/i },
        ],
        fallback: { lineId: 'hp-laptop', baseName: 'HP 노트북', baseKeyword: 'HP 노트북' },
    },
    {
        brand: 'ASUS',
        lines: [
            { lineId: 'asus-rog', baseName: 'ASUS ROG', baseKeyword: 'ASUS ROG', regex: /ROG/i },
            { lineId: 'asus-zenbook', baseName: 'ASUS ZenBook', baseKeyword: 'ASUS 젠북', regex: /ZenBook|젠북/i },
            { lineId: 'asus-vivobook', baseName: 'ASUS VivoBook', baseKeyword: 'ASUS 비보북', regex: /VivoBook|비보북/i },
        ],
        fallback: { lineId: 'asus-laptop', baseName: 'ASUS 노트북', baseKeyword: 'ASUS 노트북' },
    },
    {
        brand: '레노버',
        lines: [
            { lineId: 'lenovo-thinkpad', baseName: '레노버 ThinkPad', baseKeyword: '레노버 씽크패드', regex: /ThinkPad|씽크패드/i },
            { lineId: 'lenovo-ideapad', baseName: '레노버 IdeaPad', baseKeyword: '레노버 아이디어패드', regex: /IdeaPad|아이디어패드/i },
            { lineId: 'lenovo-yoga', baseName: '레노버 Yoga', baseKeyword: '레노버 요가', regex: /Yoga|요가/i },
        ],
        fallback: { lineId: 'lenovo-laptop', baseName: '레노버 노트북', baseKeyword: '레노버 노트북' },
    },
    {
        brand: 'MSI',
        lines: [],
        fallback: { lineId: 'msi-laptop', baseName: 'MSI 노트북', baseKeyword: 'MSI 노트북' },
    },
    {
        brand: 'Dell',
        lines: [
            { lineId: 'dell-xps', baseName: 'Dell XPS', baseKeyword: 'Dell XPS', regex: /XPS/i },
            { lineId: 'dell-inspiron', baseName: 'Dell Inspiron', baseKeyword: 'Dell 인스피론', regex: /Inspiron|인스피론/i },
            { lineId: 'dell-latitude', baseName: 'Dell Latitude', baseKeyword: 'Dell 래티튜드', regex: /Latitude|래티튜드/i },
        ],
        fallback: { lineId: 'dell-laptop', baseName: 'Dell 노트북', baseKeyword: 'Dell 노트북' },
    },
    {
        brand: '한성컴퓨터',
        lines: [
            { lineId: 'hansung-tfg', baseName: '한성 TFG', baseKeyword: '한성 TFG', regex: /TFG/i },
        ],
        fallback: { lineId: 'hansung-laptop', baseName: '한성 노트북', baseKeyword: '한성 노트북' },
    },
    {
        brand: '베이직스',
        lines: [],
        fallback: { lineId: 'basics-laptop', baseName: '베이직스 노트북', baseKeyword: '베이직스 노트북' },
    },
];

// 브랜드 감지용 패턴 (brandClassifier.ts와 동일 순서)
const BRAND_DETECT_PATTERNS: Array<{ brand: string; regex: RegExp }> = [
    { brand: 'Apple', regex: /맥북|MacBook|macbook|아이패드|iPad|Apple|애플|맥미니|Mac mini|맥스튜디오|Mac Studio/i },
    { brand: '삼성전자', regex: /삼성|Samsung|갤럭시북|Galaxy Book/i },
    { brand: 'LG전자', regex: /LG전자|LG 그램|LG gram|LG/i },
    { brand: 'HP', regex: /\bHP\b|엘리트북|EliteBook|스펙터|Spectre|파빌리온|Pavilion|OMEN|오멘/i },
    { brand: 'ASUS', regex: /에이수스|ASUS|아수스|ROG|비보북|VivoBook|젠북|ZenBook/i },
    { brand: '레노버', regex: /레노버|Lenovo|씽크패드|ThinkPad|아이디어패드|IdeaPad|요가|Yoga/i },
    { brand: 'MSI', regex: /\bMSI\b/i },
    { brand: 'Dell', regex: /\b델\b|Dell|인스피론|Inspiron|\bXPS\b|래티튜드|Latitude/i },
    { brand: '한성컴퓨터', regex: /한성|TFG|한성컴퓨터/i },
    { brand: '베이직스', regex: /베이직스|Basics/i },
];

function detectBrand(productName: string): string {
    for (const { brand, regex } of BRAND_DETECT_PATTERNS) {
        if (regex.test(productName)) {
            return brand;
        }
    }
    return '기타';
}

/**
 * 제품명에서 제품 라인을 분류
 */
export function classifyProductLine(productName: string): ProductLine {
    const brand = detectBrand(productName);
    const config = BRAND_LINE_CONFIGS.find(c => c.brand === brand);

    if (!config) {
        const words = productName.split(/\s+/).slice(0, 3).join(' ');
        const lineId = 'other-' + words.toLowerCase().replace(/[^a-z0-9가-힣]/g, '-').replace(/-+/g, '-');
        return { lineId, displayName: words, searchKeyword: words, brand: '기타', category: '기타' };
    }

    // 브랜드별 라인 패턴 매칭
    for (const line of config.lines) {
        if (line.regex.test(productName)) {
            let displayName = line.baseName;
            let searchKeyword = line.baseKeyword;
            let lineIdSuffix = '';
            let generation = '';

            // 세대 추출 (genRegex)
            if (line.genRegex) {
                const genMatch = productName.match(line.genRegex);
                const gen = genMatch?.[1] || genMatch?.[2] || '';
                if (gen) {
                    generation = gen;
                    displayName += gen;
                    searchKeyword += gen;
                    lineIdSuffix += `-${gen}`;
                }
            }

            // 칩셋 추출 (chipRegex) - Apple
            if (line.chipRegex) {
                const chipMatch = productName.match(line.chipRegex);
                if (chipMatch?.[1]) {
                    const chip = `M${chipMatch[1]}`;
                    generation = chip;
                    displayName += ` ${chip}`;
                    searchKeyword += ` ${chip}`;
                    lineIdSuffix += `-m${chipMatch[1]}`;
                }
            }

            // 서브라인 추출
            if (line.subLines) {
                for (const sub of line.subLines) {
                    if (sub.regex.test(productName)) {
                        displayName += ` ${sub.name}`;
                        searchKeyword += ` ${sub.keyword}`;
                        lineIdSuffix += `-${sub.name.toLowerCase().replace(/\s+/g, '')}`;
                        break; // 첫 번째 매칭만 사용
                    }
                }
            }

            return {
                lineId: line.lineId + lineIdSuffix,
                displayName,
                searchKeyword,
                brand: config.brand,
                category: line.category || '노트북',
                generation: generation || undefined,
            };
        }
    }

    // fallback
    return {
        lineId: config.fallback.lineId,
        displayName: config.fallback.baseName,
        searchKeyword: config.fallback.baseKeyword,
        brand: config.brand,
        category: config.fallback.category || '노트북',
    };
}

/**
 * 제품명 배열에서 고유한 제품 라인 목록 추출
 */
export function getUniqueProductLines(productNames: string[]): ProductLine[] {
    const seen = new Set<string>();
    const lines: ProductLine[] = [];

    for (const name of productNames) {
        const line = classifyProductLine(name);
        if (!seen.has(line.lineId)) {
            seen.add(line.lineId);
            lines.push(line);
        }
    }

    return lines;
}

/**
 * 제품명에서 제품 라인 ID 반환
 */
export function getProductLineId(productName: string): string {
    return classifyProductLine(productName).lineId;
}
