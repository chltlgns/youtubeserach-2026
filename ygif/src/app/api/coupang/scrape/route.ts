import { NextRequest, NextResponse } from 'next/server';

export interface ScrapeResult {
    url: string;
    productName: string;
    currentPrice: number;
    originalPrice: number;
    discountRate: string;
    success: boolean;
    error?: string;
}

export async function POST(request: NextRequest) {
    // Check if scraper is enabled (requires local environment with browser)
    if (process.env.ENABLE_SCRAPER !== 'true') {
        return NextResponse.json(
            { error: '이 기능은 로컬 환경에서만 사용 가능합니다. ENABLE_SCRAPER=true 환경변수를 설정해주세요.' },
            { status: 503 }
        );
    }

    // Dynamic import hidden from Turbopack bundler analysis
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let puppeteer: any;
    try {
        // eslint-disable-next-line no-eval
        puppeteer = await eval("import('puppeteer')");
    } catch {
        return NextResponse.json(
            { error: 'Puppeteer를 로드할 수 없습니다. 로컬 환경에서 npm install puppeteer를 실행해주세요.' },
            { status: 503 }
        );
    }

    // Random scroll patterns
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scrollPatterns = [
        async (page: any) => {
            await page.evaluate(() => window.scrollBy(0, 200));
            await new Promise(r => setTimeout(r, 500));
            await page.evaluate(() => window.scrollBy(0, 300));
        },
        async (page: any) => {
            await page.evaluate(() => window.scrollBy(0, 500));
            await new Promise(r => setTimeout(r, 600));
            await page.evaluate(() => window.scrollBy(0, -100));
        },
        async (page: any) => {
            await page.evaluate(() => window.scrollBy(0, 400));
            await new Promise(r => setTimeout(r, 800));
        },
        async (page: any) => {
            for (let i = 0; i < 3; i++) {
                await page.evaluate(() => window.scrollBy(0, 150 + Math.random() * 100));
                await new Promise(r => setTimeout(r, 300));
            }
        },
    ];

    async function extractProductData(page: any, url: string): Promise<ScrapeResult> {
        try {
            const pageTitle = await page.title();

            if (pageTitle.includes('Access Denied') || pageTitle === '') {
                throw new Error('Access Denied');
            }

            const patternIndex = Math.floor(Math.random() * scrollPatterns.length);
            await scrollPatterns[patternIndex](page);
            await new Promise(r => setTimeout(r, 1000));

            const productData = await page.evaluate(() => {
                const nameEl = document.querySelector('h1.product-title span.twc-font-bold, h1.product-title, .prod-buy-header__title');
                const name = nameEl ? nameEl.textContent?.trim() : document.title.split(' - ')[0];

                const priceEl = document.querySelector('.final-price-amount, .price-amount.final-price-amount, .prod-sale-price strong');
                let price = priceEl ? priceEl.textContent?.replace(/[^0-9]/g, '') : '0';

                if (!price || price === '0') {
                    const allPriceElements = document.querySelectorAll('[class*="price"]');
                    for (const el of allPriceElements) {
                        const text = el.textContent || '';
                        const match = text.match(/[\d,]+원/);
                        if (match) {
                            price = match[0].replace(/[^0-9]/g, '');
                            break;
                        }
                    }
                }

                const allPrices = document.querySelectorAll('.price-amount');
                let original = price || '0';
                allPrices.forEach((el) => {
                    const t = el.textContent?.replace(/[^0-9]/g, '') || '0';
                    if (parseInt(t) > parseInt(original)) original = t;
                });

                let discount = '0%';
                const priceNum = parseInt(price || '0');
                const originalNum = parseInt(original || '0');
                if (originalNum > priceNum && priceNum > 0) {
                    discount = Math.round((1 - priceNum / originalNum) * 100) + '%';
                }

                return {
                    productName: name || '',
                    currentPrice: priceNum,
                    originalPrice: originalNum,
                    discountRate: discount,
                };
            });

            return {
                url,
                ...productData,
                success: productData.currentPrice > 0,
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[Coupang Scraper] Error:`, errorMessage);
            return {
                url,
                productName: '',
                currentPrice: 0,
                originalPrice: 0,
                discountRate: '0%',
                success: false,
                error: errorMessage,
            };
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let browser: any = null;
    const YGIF_BASE_URL = process.env.YGIF_BASE_URL || 'http://localhost:3000';
    const userDataDir = process.env.PUPPETEER_USER_DATA_DIR || 'C:\\Users\\campu\\AppData\\Local\\CoupangScraperChrome';

    try {
        const { urls } = await request.json();

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return NextResponse.json({ error: 'URLs array is required' }, { status: 400 });
        }

        const batchUrls: string[] = urls.slice(0, 50);

        browser = await puppeteer.default.launch({
            headless: false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--start-maximized',
                `--user-data-dir=${userDataDir}`,
                '--lang=ko-KR',
            ],
            defaultViewport: null,
            ignoreDefaultArgs: ['--enable-automation'],
        });

        const page = await browser.newPage();
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            // @ts-expect-error - chrome doesn't exist on window type
            window.chrome = { runtime: {} };
        });

        await page.goto(`${YGIF_BASE_URL}/coupang`, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));

        const results: ScrapeResult[] = [];

        for (let i = 0; i < batchUrls.length; i++) {
            const targetUrl = batchUrls[i];

            try {
                const currentUrl = page.url();
                if (!currentUrl.includes('/coupang')) {
                    await page.goto(`${YGIF_BASE_URL}/coupang`, { waitUntil: 'networkidle2' });
                    await new Promise(r => setTimeout(r, 2000));
                }

                const productIdMatch = targetUrl.match(/products\/(\d+)/);
                const productId = productIdMatch ? productIdMatch[1] : '';

                const linkSelector = productId
                    ? `a[href*="${productId}"]`
                    : `a[href*="coupang.com"]`;

                await page.waitForSelector(linkSelector, { timeout: 10000 });

                const pagesBefore = await browser.pages();
                await page.click(linkSelector);
                await new Promise(r => setTimeout(r, 3000));

                const pagesAfter = await browser.pages();

                let coupangPage: any = null;
                for (const p of pagesAfter) {
                    const url = p.url();
                    if (url.includes('coupang.com') && !pagesBefore.some((bp: any) => bp === p)) {
                        coupangPage = p;
                        break;
                    }
                }

                if (!coupangPage) {
                    for (const p of pagesAfter) {
                        if (p.url().includes('coupang.com')) {
                            coupangPage = p;
                            break;
                        }
                    }
                }

                if (!coupangPage) {
                    throw new Error('Could not find Coupang page after click');
                }

                await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));

                const result = await extractProductData(coupangPage, targetUrl);
                results.push(result);

                await coupangPage.close();

                if (i < batchUrls.length - 1) {
                    const waitTime = 4000 + Math.random() * 2000;
                    await new Promise(r => setTimeout(r, waitTime));
                }

            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error(`[Coupang Scraper] Error for product ${i + 1}:`, errorMessage);
                results.push({
                    url: targetUrl,
                    productName: '',
                    currentPrice: 0,
                    originalPrice: 0,
                    discountRate: '0%',
                    success: false,
                    error: errorMessage,
                });
            }
        }

        await browser.close();

        return NextResponse.json({
            success: true,
            results,
            processed: results.length,
            failed: results.filter(r => !r.success).length,
        });

    } catch (error: unknown) {
        console.error('[Coupang Scraper] Fatal error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (browser) await browser.close();
        return NextResponse.json({ error: '스크래핑 실패', details: errorMessage }, { status: 500 });
    }
}
