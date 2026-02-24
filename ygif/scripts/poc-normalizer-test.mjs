/**
 * PoC Test: AI Product Name Normalizer
 *
 * Tests Gemini 2.0 Flash with real Coupang product names from Supabase.
 * Compares AI normalization quality vs current regex classifier.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env from project root (cwd)
const envPath = resolve(process.cwd(), '.env');
const envContent = readFileSync(envPath, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const idx = line.indexOf('=');
  if (idx > 0 && !line.startsWith('#')) {
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    envVars[key] = val;
  }
}

const GEMINI_API_KEY = envVars.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY not found in .env');
  process.exit(1);
}

// ============ SYSTEM PROMPT ============
const SYSTEM_PROMPT = `You are a Korean e-commerce product name normalizer for Coupang.

## Rules
1. STRIP all noise: seller markers ([정품], ★특가★, 무료배송, 당일출고, 사은품증정, 공식파트너, 한컴오피스팩 동봉), SKU/model numbers (NT960XGQ-A71A, MQT93KH/A, (362589), M3607HA-SH112), detailed specs (16GB, 256GB SSD, DDR5, 8코어, FHD, WQXGA), colors (스페이스그레이, 실버, 블랙, 그레이, 화이트, 매트 그레이), shipping/warranty info, OS info (WIN11 Home, Free DOS, MAC OS).
2. KEEP: brand, product line name, generation/version, chip/processor family (M3, Ultra 7, Ryzen 9, 코어i5), form factor if it differentiates (14인치 vs 16인치 only when it defines a distinct product line), and GPU model for gaming laptops.
3. When brand appears in both English and Korean (e.g., "Apple 애플", "Samsung 삼성"), use the more commonly searched form in Korea.
4. For trend_keywords, generate terms that KOREAN CONSUMERS actually type into search engines. Prioritize: Korean name > English name. Always include at least one pure-Korean keyword. Keywords should be SPECIFIC enough to distinguish from other products.
5. If a product is an accessory (case, charger, cable), set category to "액세서리" and product_line to the target device name.
6. If a product is a bundle (본체+모니터), extract only the primary product.
7. If a product is refurbished/리퍼, include "리퍼" in the product_line.
8. year should be the product release year, NOT the current year, inferred from context. If unknown, set to null.
9. For gaming laptops, include the GPU in product_line if it's a key differentiator.

## Categories
노트북, 데스크탑, 태블릿, 모니터, 키보드, 마우스, 액세서리, 기타

## Output Format (strict JSON array, no markdown)
Each object: {"brand":"str","product_line":"str","generation":"str or null","year":"str or null","trend_keywords":["k1","k2","k3"],"category":"str","confidence":0.0-1.0}

## Examples
Input: "삼성전자 갤럭시북5 프로 NT960XHZ-A52A 인텔 울트라5 16인치 고해상도 AI 노트북 사무용 대학생 터치스크린 노트북그레이 · NT960XHZ-A52AR · 코어Ultra5 · 2TB · 32GB · WIN11 Home"
Output: {"brand":"삼성","product_line":"갤럭시북5 프로 16","generation":"울트라5","year":"2025","trend_keywords":["갤럭시북5 프로","갤럭시북5 프로 16인치","Galaxy Book5 Pro"],"category":"노트북","confidence":0.95}

Input: "Apple 2024 맥미니 M4 Pro 24GB 512GB"
Output: {"brand":"Apple","product_line":"맥미니 M4 Pro","generation":"M4 Pro","year":"2024","trend_keywords":["맥미니 M4 프로","맥미니 2024","Mac Mini M4 Pro"],"category":"데스크탑","confidence":0.95}

Input: "노트킹 65W GaN PPS PD 초소형 초고속 충전기 | C타입 케이블일체형 | 삼성 LG 아이폰 갤럭시 태블릿 노트북 호환"
Output: {"brand":"노트킹","product_line":"65W GaN USB-C 충전기","generation":null,"year":null,"trend_keywords":["노트북 충전기 65W","USB-C PD 충전기 GaN"],"category":"액세서리","confidence":0.75}`;

// ============ TEST DATA (50 real Coupang product names) ============
const PRODUCT_NAMES = [
  "HP 2025 올인원 PC 코어i5 인텔 13세대",
  "애플 2024 맥미니 M4 Pro 24GB 512GB 포함",
  "10코어 CPU와 10코어 GPU가 탑재된 M4 칩이 탑재된 Apple 2024 Mac 미니 데스크톱 컴퓨터: Apple 인텔리전스 16GB 통합 메모리 256GB SSD 스토",
  "[삼성전자 공식파트너] 삼성노트북 갤럭시북 인텔 가성비 사무용 업무용 인강용 대학생 저렴한 싼 노트북추천그레이 · NT750XGR · 2TB · 16GB · WIN11 Home",
  "[삼성전자 공식파트너] 갤럭시북4 15.6 코어I5 13세대 가성비 노트북 한컴오피스팩 동봉R-A51AG · WIN11 Home · 16GB · 1TB · 그레이",
  "[삼성전자 공식파트너] 갤럭시북5 프로 14인치 인텔 울트라7 32GB 터치스크린 사무용 고사양 영상편집 노트북NT940 · Free DOS · 32GB · 512GB · 그레이",
  "삼성전자 갤럭시북5 프로 NT960XHZ-A52A 인텔 울트라5 16인치 고해상도 AI 노트북 사무용 대학생 터치스크린 노트북그레이 · NT960XHZ-A52AR · 코어Ultra5 · 2TB · 32GB · WIN11 Home",
  "[삼성전자 공식파트너] 갤럭시북4 인텔 코어 i7 윈도우11 가성비 사무용 대학생 동영상 노트북 한컴오피스팩 동봉.그레이 · NT750XGR-A71A · 1TB · 16GB · WIN11 Home",
  "[삼성전자 공식파트너] 갤럭시북5 프로 14인치(35 5cm) 인텔 Ultra 5 터치스크린 서울/경기 퀵서비스 최대 2만원 지원그레이 · NT940XHA-K51AG · 256GB · 16GB · WIN11 Home",
  "삼성전자 갤럭시북5 프로 NT960XHA-K52A 인텔 울트라5 16인치 고해상도 AI 코파일럿+ 윈도우11 터치스크린 직장인 대학생 노트북갤럭시북5 프로 · WIN11 Home · 32GB · 512GB · 그레이",
  "삼성전자 갤럭시북5 프로 NT960XHA / NT960XHZ 16인치 인텔 울트라7 영상편집 사무용 코딩용 대학생 고사양 고해상도 터치 디스플레이 WQXGA+ AI 노트북 추천갤럭시북5 프로 · WIN11 Pro · 32GB · 512GB · 그레이",
  "[삼성전자 공식파트너] 갤럭시북Go NT345XPA-K14AS 윈도우11 14인치 휴대용 가성비 학생용 문서작성 5G LTENT345XPA-K14AS · WIN11 Home · 4GB · 128GB · 실버",
  "LG전자 2025 그램 Pro AI 16 WQXGA 코어Ultra5 애로우레이크",
  "LG전자 2026 그램 AI 15 라이젠 AI 400 시리즈 방문설치",
  "LG전자 2026 그램 Pro AI 16 라이젠 AI 400 시리즈 방문설치",
  "LG전자 2024 그램 16 코어Ultra5",
  "LG전자 2025 그램 Pro AI 17 WQXGA 코어Ultra5 애로우레이크",
  "LG전자 2024 그램 14 코어Ultra5",
  "LG전자 2026 그램 15 코어 Ultra5",
  "LG전자 2023 울트라 PC 15 코어i5 인텔 13세대 지포스 MX550",
  "맥북에어 M1 8GB 256GB 16GB 512GB 8코어 A2337 13인치 노트북A2337 · MAC OS · 16GB · 512GB · M1",
  "JUMPER 2026 노트북 16인치 화면 대형 셀러론N5095 512GB SSD+128GB eMMc 16GB RAM office 365사무용 WIN11 home-펄 화이트",
  "삼성 갤럭시북4 15.6인치 인텔 사무용 업무용 인강용 학생용 저렴한 노트북NT750XGR-A28A · Free DOS · 8GB · 512GB · 그레이",
  "마이크로소프트 2024 서피스 프로 11 13 스냅드래곤 X 엘리트 + 키보드 + 슬림펜2노트북 블랙 + 키보드 블랙 · 512GB · 16GB · WIN11 Home · 노트북(ZIA-00032), 키보드+슬림펜2(8X6-00184)",
  "LG전자 그램 Pro 인텔 코어 Ultra7 14세대 16GB 32GB 1TB 2TB 윈도우11 (상품 확인 필수)17인치 블랙 · 울트라7 15세대 · 1TB · 32GB · WIN11 Home",
  "Apple 2025 맥북 에어 13 M4",
  "Apple 2023 맥미니 M2M2 8코어 · 10코어 · 256GB · 16GB",
  "노트킹 65W GaN PPS PD 초소형 초고속 충전기 | C타입 케이블일체형 | 삼성 LG 아이폰 갤럭시 태블릿 노트북 호환",
  "에이수스 2025 젠북 S 14 OLED 코어Ultra7",
  "에이수스 2025 비보북 16 코어5 인텔 14세대 지포스 RTX 4050",
  "HP 2025 오멘 16 라이젠 AI 라이젠 AI 300 시리즈 지포스 RTX 5060",
  "HP 2025 노트북 15 N-시리즈 N-시리즈",
  "에이수스 2025 비보북 16 코어5 인텔 14세대",
  "에이수스 2025 비보북 15 라이젠7 라이젠 5000 시리즈",
  "에이수스 2025 비보북 18 라이젠7",
  "에이수스 비보북 S 16 M3607HA-SH112 라이젠7M3607HA-SH112 · WIN11 Pro · 32GB · 512GB · 매트 그레이",
  "LG 울트라PC 15U560 6세대 i5 지포스940M 15.6인치 윈도우108GB · 15U560 · WIN10 Pro · 756GB · 코어i5 · 화이트",
  "에이수스 2025 젠북 S 16 OLED 코어Ultra7",
  "에이수스 2025 TUF 게이밍 노트북 A16 라이젠7 260 지포스 RTX 5060",
  "에이수스 2025 게이밍 V16 코어5 지포스 RTX 5050",
  "에이수스 2025 TUF 게이밍 F16 코어i7 인텔 13세대 지포스 RTX 5070",
  "에이수스 2025 젠북 14 코어Ultra7포기 실버 · 512GB · 32GB · WIN11 Home · UX3405CA-PZ516W",
  "에이수스 2025 비보북 16 스냅드래곤",
  "에이수스 비보북 S 16 M3607HA-SH113 라이젠5M3607HA-SH113 · WIN11 Pro · 32GB · 1TB · 매트 그레이",
  "에이수스 2025 비보북 S14 라이젠 AI 라이젠 AI 300 시리즈매트 그레이 · 512GB · 16GB · WIN11 Home · M3407KA-SF073W",
  "에이수스 2025 게이밍 V16 코어5 지포스 RTX 5060",
  "HP 2025 노트북 17 코어i3 인텔 12세대",
  "베이직스 베이직북 16 N-series N95화이트 · 256GB · 8GB · WIN11 Pro · BB1624FW",
  "에이수스 2025 비보북 16 코어Ultra5",
  "HP 2025 옴니북 X 플립 14 OLED 라이젠7 AI 350 크라켄포인트",
];

const BATCH_SIZE = 15;

// ============ GEMINI CALL ============
async function normalizeWithGemini(genAI, productNames) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
    },
  });

  const numbered = productNames.map((name, i) => `${i + 1}. ${name}`).join('\n');
  const userPrompt = `Normalize these ${productNames.length} Coupang product names. Return a JSON array with exactly ${productNames.length} objects in the same order.\n\nProducts:\n${numbered}`;

  const result = await model.generateContent(userPrompt);

  const text = result.response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Failed to parse JSON');
    parsed = JSON.parse(jsonMatch[0]);
  }

  return parsed;
}

// ============ SIMPLE REGEX CLASSIFIER (current system) ============
function classifyWithRegex(productName) {
  const brandPatterns = [
    { brand: 'Apple', regex: /맥북|MacBook|macbook|아이패드|iPad|Apple|애플|맥미니|Mac 미니/i },
    { brand: '삼성전자', regex: /삼성|Samsung|갤럭시북|Galaxy Book/i },
    { brand: 'LG전자', regex: /LG전자|LG 그램|LG gram|LG 울트라|LG/i },
    { brand: 'HP', regex: /\bHP\b|엘리트북|EliteBook|스펙터|Spectre|파빌리온|Pavilion|OMEN|오멘|옴니북/i },
    { brand: 'ASUS', regex: /에이수스|ASUS|아수스|ROG|비보북|VivoBook|젠북|ZenBook|TUF/i },
    { brand: '레노버', regex: /레노버|Lenovo|씽크패드|ThinkPad|아이디어패드|IdeaPad|요가|Yoga/i },
    { brand: 'MSI', regex: /\bMSI\b/i },
    { brand: 'Dell', regex: /\b델\b|Dell|인스피론|Inspiron|\bXPS\b|래티튜드|Latitude/i },
    { brand: '베이직스', regex: /베이직스|Basics/i },
  ];

  let brand = '기타';
  for (const p of brandPatterns) {
    if (p.regex.test(productName)) { brand = p.brand; break; }
  }

  // Very simplified line extraction
  let keyword = productName.split(/\s+/).slice(0, 3).join(' ');

  if (brand === 'Apple') {
    if (/맥북\s*프로|MacBook\s*Pro/i.test(productName)) keyword = '맥북프로';
    else if (/맥북\s*에어|MacBook\s*Air/i.test(productName)) keyword = '맥북에어';
    else if (/맥미니|Mac\s*미니/i.test(productName)) keyword = '맥미니';
    else keyword = '맥북';
  } else if (brand === '삼성전자') {
    if (/갤럭시\s*북/i.test(productName)) keyword = '갤럭시북';
    else keyword = '삼성 노트북';
  } else if (brand === 'LG전자') {
    if (/그램/i.test(productName)) keyword = 'LG 그램';
    else keyword = 'LG 노트북';
  } else if (brand === 'ASUS') {
    if (/젠북|ZenBook/i.test(productName)) keyword = 'ASUS 젠북';
    else if (/비보북|VivoBook/i.test(productName)) keyword = 'ASUS 비보북';
    else if (/ROG/i.test(productName)) keyword = 'ASUS ROG';
    else if (/TUF/i.test(productName)) keyword = 'ASUS TUF';
    else keyword = 'ASUS 노트북';
  } else if (brand === 'HP') {
    if (/OMEN|오멘/i.test(productName)) keyword = 'HP OMEN';
    else if (/옴니북/i.test(productName)) keyword = 'HP 옴니북';
    else keyword = 'HP 노트북';
  }

  return { brand, keyword };
}

// ============ MAIN ============
async function main() {
  console.log('='.repeat(80));
  console.log('  PoC Test: AI Product Name Normalizer');
  console.log('  Model: gemini-2.0-flash | Temperature: 0 | Products: ' + PRODUCT_NAMES.length);
  console.log('='.repeat(80));
  console.log('');

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const allResults = [];
  let totalTokens = 0;
  const startTime = Date.now();

  // Process in batches
  for (let i = 0; i < PRODUCT_NAMES.length; i += BATCH_SIZE) {
    const batch = PRODUCT_NAMES.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(PRODUCT_NAMES.length / BATCH_SIZE);

    console.log(`\n--- Batch ${batchNum}/${totalBatches} (${batch.length} products) ---`);
    const batchStart = Date.now();

    try {
      const results = await normalizeWithGemini(genAI, batch);
      const batchTime = Date.now() - batchStart;
      console.log(`  OK: ${results.length} results in ${batchTime}ms`);

      for (let j = 0; j < batch.length; j++) {
        allResults.push({
          input: batch[j],
          ai: results[j],
          regex: classifyWithRegex(batch[j]),
        });
      }
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
      for (const name of batch) {
        allResults.push({
          input: name,
          ai: null,
          regex: classifyWithRegex(name),
        });
      }
    }

    // Rate limit delay between batches
    if (i + BATCH_SIZE < PRODUCT_NAMES.length) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  const totalTime = Date.now() - startTime;

  // ============ RESULTS TABLE ============
  console.log('\n' + '='.repeat(120));
  console.log('  COMPARISON: AI vs Regex');
  console.log('='.repeat(120));
  console.log('');

  let aiSuccess = 0;
  let aiImproved = 0;
  const categories = {};
  const dedup = {};

  for (let i = 0; i < allResults.length; i++) {
    const { input, ai, regex } = allResults[i];
    const shortInput = input.length > 50 ? input.slice(0, 50) + '...' : input;

    if (ai) {
      aiSuccess++;

      // Track categories
      categories[ai.category] = (categories[ai.category] || 0) + 1;

      // Track dedup (by brand + product_line + generation)
      const dedupKey = `${ai.brand}::${ai.product_line}::${ai.generation || ''}`;
      if (!dedup[dedupKey]) dedup[dedupKey] = [];
      dedup[dedupKey].push(i + 1);

      // Check if AI keyword is more specific than regex
      const aiKeyword = ai.trend_keywords?.[0] || ai.product_line;
      const isImproved = aiKeyword.length > regex.keyword.length ||
                         (aiKeyword !== regex.keyword && ai.confidence >= 0.7);
      if (isImproved) aiImproved++;

      console.log(`#${String(i + 1).padStart(2)} [${ai.confidence >= 0.8 ? '✓' : '△'}] ${shortInput}`);
      console.log(`     Regex:  [${regex.brand}] "${regex.keyword}"`);
      console.log(`     AI:     [${ai.brand}] "${ai.product_line}" → keywords: ${JSON.stringify(ai.trend_keywords)}`);
      console.log(`     Category: ${ai.category} | Generation: ${ai.generation || '-'} | Year: ${ai.year || '-'} | Confidence: ${ai.confidence}`);
      if (isImproved) console.log(`     ★ IMPROVED keyword specificity`);
      console.log('');
    } else {
      console.log(`#${String(i + 1).padStart(2)} [✗] ${shortInput}`);
      console.log(`     Regex:  [${regex.brand}] "${regex.keyword}"`);
      console.log(`     AI:     FAILED`);
      console.log('');
    }
  }

  // ============ SUMMARY ============
  console.log('='.repeat(80));
  console.log('  SUMMARY');
  console.log('='.repeat(80));
  console.log(`  Total products:      ${PRODUCT_NAMES.length}`);
  console.log(`  AI success:          ${aiSuccess}/${PRODUCT_NAMES.length} (${Math.round(aiSuccess/PRODUCT_NAMES.length*100)}%)`);
  console.log(`  AI improved keyword: ${aiImproved}/${PRODUCT_NAMES.length} (${Math.round(aiImproved/PRODUCT_NAMES.length*100)}%)`);
  console.log(`  Total time:          ${totalTime}ms (${Math.round(totalTime/1000)}s)`);
  console.log(`  Avg per batch:       ${Math.round(totalTime / Math.ceil(PRODUCT_NAMES.length / BATCH_SIZE))}ms`);
  console.log('');

  console.log('  Categories:');
  for (const [cat, count] of Object.entries(categories).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cat}: ${count}`);
  }
  console.log('');

  // Deduplication analysis
  const groups = Object.entries(dedup).filter(([_, ids]) => ids.length > 1);
  console.log(`  Deduplication:`);
  console.log(`    Unique product lines: ${Object.keys(dedup).length}`);
  console.log(`    Groups with duplicates: ${groups.length}`);
  for (const [key, ids] of groups) {
    console.log(`      "${key}" → products #${ids.join(', #')}`);
  }
  console.log('');

  // Confidence distribution
  const confBuckets = { high: 0, medium: 0, low: 0 };
  for (const { ai } of allResults) {
    if (!ai) continue;
    if (ai.confidence >= 0.8) confBuckets.high++;
    else if (ai.confidence >= 0.5) confBuckets.medium++;
    else confBuckets.low++;
  }
  console.log(`  Confidence distribution:`);
  console.log(`    High (≥0.8):   ${confBuckets.high}`);
  console.log(`    Medium (≥0.5): ${confBuckets.medium}`);
  console.log(`    Low (<0.5):    ${confBuckets.low} (would use regex fallback)`);
  console.log('');
  console.log('='.repeat(80));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
