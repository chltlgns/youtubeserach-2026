import { NextRequest, NextResponse } from 'next/server';
import puppeteer, { Browser, Page } from 'puppeteer';

export interface ScrapeResult {
    url: string;
    productName: string;
    currentPrice: number;
    originalPrice: number;
    discountRate: string;
    success: boolean;
    error?: string;
}

// Random scroll patterns
const scrollPatterns = [
    async (page: Page) => {
        await page.evaluate(() => window.scrollBy(0, 200));
        await new Promise(r => setTimeout(r, 500));
        await page.evaluate(() => window.scrollBy(0, 300));
    },
    async (page: Page) => {
        await page.evaluate(() => window.scrollBy(0, 500));
        await new Promise(r => setTimeout(r, 600));
        await page.evaluate(() => window.scrollBy(0, -100));
    },
    async (page: Page) => {
        await page.evaluate(() => window.scrollBy(0, 400));
        await new Promise(r => setTimeout(r, 800));
    },
    async (page: Page) => {
        for (let i = 0; i < 3; i++) {
            await page.evaluate(() => window.scrollBy(0, 150 + Math.random() * 100));
            await new Promise(r => setTimeout(r, 300));
        }
    },
];

async function extractProductData(page: Page, url: string): Promise<ScrapeResult> {
    try {
        // Check for Access Denied
        const pageTitle = await page.title();
        console.log(`[Coupang Scraper] Page: ${pageTitle}`);

        if (pageTitle.includes('Access Denied') || pageTitle === '') {
            throw new Error('Access Denied');
        }

        // Apply random scroll pattern
        const patternIndex = Math.floor(Math.random() * scrollPatterns.length);
        console.log(`[Coupang Scraper] Scroll pattern ${patternIndex + 1}`);
        await scrollPatterns[patternIndex](page);
        await new Promise(r => setTimeout(r, 1000));

        // Extract data
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

        console.log(`[Coupang Scraper] Result: ${productData.productName} - ${productData.currentPrice}원`);

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

export async function POST(request: NextRequest) {
    console.log('[Coupang Scraper] Starting (click navigation method)...');

    let browser: Browser | null = null;

    try {
        const { urls } = await request.json();

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return NextResponse.json({ error: 'URLs array is required' }, { status: 400 });
        }

        const batchUrls: string[] = urls.slice(0, 50);
        console.log(`[Coupang Scraper] Processing ${batchUrls.length} URLs via link click`);

        const userDataDir = 'C:\\Users\\campu\\AppData\\Local\\CoupangScraperChrome';

        browser = await puppeteer.launch({
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

        console.log('[Coupang Scraper] Browser launched');

        // Override webdriver detection
        const page = await browser.newPage();
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            // @ts-expect-error - chrome doesn't exist on window type
            window.chrome = { runtime: {} };
        });

        // Step 1: Go to our YGIF Coupang page
        console.log('[Coupang Scraper] Opening YGIF Coupang page...');
        await page.goto('http://localhost:3000/coupang', { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));

        const results: ScrapeResult[] = [];

        // Step 2: For each product, find and click the link
        for (let i = 0; i < batchUrls.length; i++) {
            const targetUrl = batchUrls[i];
            console.log(`\n[Coupang Scraper] === Product ${i + 1}/${batchUrls.length} ===`);

            try {
                // Go back to our YGIF page if not already there
                const currentUrl = page.url();
                if (!currentUrl.includes('localhost:3000/coupang')) {
                    console.log('[Coupang Scraper] Navigating back to YGIF...');
                    await page.goto('http://localhost:3000/coupang', { waitUntil: 'networkidle2' });
                    await new Promise(r => setTimeout(r, 2000));
                }

                // Find and click the product link that matches this URL
                console.log('[Coupang Scraper] Looking for product link...');

                // Find link by href containing part of the URL (product ID)
                const productIdMatch = targetUrl.match(/products\/(\d+)/);
                const productId = productIdMatch ? productIdMatch[1] : '';

                const linkSelector = productId
                    ? `a[href*="${productId}"]`
                    : `a[href*="coupang.com"]`;

                console.log(`[Coupang Scraper] Looking for link with: ${linkSelector}`);

                // Wait for the link to be visible
                await page.waitForSelector(linkSelector, { timeout: 10000 });

                // Click the link (opens in new tab due to target="_blank")
                console.log('[Coupang Scraper] Clicking product link...');

                // Get all pages before clicking
                const pagesBefore = await browser.pages();

                // Click the link
                await page.click(linkSelector);

                // Wait for new tab to open
                await new Promise(r => setTimeout(r, 3000));

                // Get all pages after clicking
                const pagesAfter = await browser.pages();

                // Find the new tab (Coupang product page)
                let coupangPage: Page | null = null;
                for (const p of pagesAfter) {
                    const url = p.url();
                    if (url.includes('coupang.com') && !pagesBefore.some(bp => bp === p)) {
                        coupangPage = p;
                        break;
                    }
                }

                // Or find by URL containing coupang
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

                console.log(`[Coupang Scraper] Coupang page opened: ${coupangPage.url()}`);

                // Wait for Coupang page to load
                await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));

                // Extract data from Coupang page
                const result = await extractProductData(coupangPage, targetUrl);
                results.push(result);

                // Close Coupang tab
                console.log('[Coupang Scraper] Closing Coupang tab...');
                await coupangPage.close();

                // Wait before next product
                if (i < batchUrls.length - 1) {
                    const waitTime = 4000 + Math.random() * 2000;
                    console.log(`[Coupang Scraper] Waiting ${Math.round(waitTime / 1000)}s...`);
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
        console.log('\n[Coupang Scraper] All done!');

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
        return NextResponse.json({ error: 'Scraping failed', details: errorMessage }, { status: 500 });
    }
}
