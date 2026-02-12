// Dynamic import types for playwright (not bundled on Vercel)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PlaywrightBrowserContext = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PlaywrightPage = any;

interface ScrapedNotebook {
    url: string;
    productName: string;
    currentPrice: number;
    originalPrice: number;
    discountRate: string;
    rating: number | null;
    reviewCount: number | null;
    monthlyPurchases: number | null;
    brand: string;
    thumbnailUrl: string | null;
}

interface ScrapeOptions {
    batchSize: number;
    minPrice?: number;
    maxPrice?: number;
    sortBy?: string;
    maxPages?: number;
}

// Source Edge profile and scraper working copy (configurable via env vars)
const EDGE_USER_DATA = process.env.EDGE_USER_DATA_DIR || 'C:\\Users\\campu\\AppData\\Local\\Microsoft\\Edge\\User Data';
const SCRAPER_USER_DATA = process.env.SCRAPER_USER_DATA_DIR || 'C:\\Users\\campu\\AppData\\Local\\CoupangScraperEdge';
const EDGE_PROFILE = process.env.EDGE_PROFILE || 'Default';

// Copy Edge cookies/session to scraper directory (works even while Edge is running)
async function syncEdgeProfile(): Promise<void> {
    const { execSync } = await import('child_process');
    const fs = await import('fs');
    const path = await import('path');

    const srcProfile = path.join(EDGE_USER_DATA, EDGE_PROFILE);
    const dstProfile = path.join(SCRAPER_USER_DATA, EDGE_PROFILE);

    // Create scraper directory
    fs.mkdirSync(dstProfile, { recursive: true });

    // Copy Local State (encryption keys for cookies)
    const localStateSrc = path.join(EDGE_USER_DATA, 'Local State');
    const localStateDst = path.join(SCRAPER_USER_DATA, 'Local State');
    if (fs.existsSync(localStateSrc)) {
        try { fs.copyFileSync(localStateSrc, localStateDst); } catch { /* locked */ }
    }

    // Key files to copy for session reuse
    const filesToCopy = [
        'Cookies',
        'Cookies-journal',
        'Login Data',
        'Login Data-journal',
        'Web Data',
        'Web Data-journal',
        'Preferences',
        'Secure Preferences',
    ];

    for (const file of filesToCopy) {
        const src = path.join(srcProfile, file);
        const dst = path.join(dstProfile, file);
        if (fs.existsSync(src)) {
            try { fs.copyFileSync(src, dst); } catch { /* may be locked, skip */ }
        }
    }

    // Also copy Network cookies (newer Edge/Chromium)
    const networkDir = path.join(dstProfile, 'Network');
    fs.mkdirSync(networkDir, { recursive: true });
    for (const file of ['Cookies', 'Cookies-journal']) {
        const src = path.join(srcProfile, 'Network', file);
        const dst = path.join(networkDir, file);
        if (fs.existsSync(src)) {
            try { fs.copyFileSync(src, dst); } catch { /* locked */ }
        }
    }

    console.log('[Scraper] Edge profile synced to scraper directory');
}

// --- Human-like timing ---

// Gaussian random: more natural than uniform distribution
function gaussianRandom(mean: number, stdDev: number): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return Math.max(0, Math.round(mean + stdDev * num));
}

function humanDelay(minMs: number, maxMs: number): Promise<void> {
    const mean = (minMs + maxMs) / 2;
    const stdDev = (maxMs - minMs) / 4;
    const delay = Math.min(maxMs * 1.5, Math.max(minMs * 0.5, gaussianRandom(mean, stdDev)));
    return new Promise(resolve => setTimeout(resolve, delay));
}

// Short pause (like thinking between actions)
function microPause(): Promise<void> {
    return humanDelay(300, 1200);
}

// Medium pause (reading content)
function readingPause(): Promise<void> {
    return humanDelay(2000, 5000);
}

// Long pause (between pages/searches)
function navigationPause(): Promise<void> {
    return humanDelay(5000, 12000);
}

// Extra long pause (between brands)
function brandPause(): Promise<void> {
    return humanDelay(10000, 20000);
}

// --- Mouse simulation ---

async function randomMouseMove(page: PlaywrightPage): Promise<void> {
    const viewportSize = page.viewportSize();
    if (!viewportSize) return;

    const moves = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < moves; i++) {
        const x = Math.floor(Math.random() * viewportSize.width * 0.8) + viewportSize.width * 0.1;
        const y = Math.floor(Math.random() * viewportSize.height * 0.8) + viewportSize.height * 0.1;
        await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 5) + 3 });
        await microPause();
    }
}

// --- Scroll simulation ---

async function humanScroll(page: PlaywrightPage): Promise<void> {
    const scrollSteps = Math.floor(Math.random() * 6) + 5; // 5-10 steps
    let previousHeight = await page.evaluate(() => document.body.scrollHeight);

    for (let i = 0; i < scrollSteps; i++) {
        const scrollAmount = Math.floor(Math.random() * 600) + 200;

        // Use smooth scrolling for more natural behavior
        await page.evaluate((amount: number) => {
            window.scrollBy({ top: amount, behavior: 'smooth' });
        }, scrollAmount);
        await humanDelay(500, 2000);

        // Check if new content appeared after scroll
        const currentHeight = await page.evaluate(() => document.body.scrollHeight);
        if (currentHeight > previousHeight) {
            console.log(`[Scraper] New content loaded after scroll (${previousHeight} -> ${currentHeight})`);
            previousHeight = currentHeight;
            // Wait a bit extra for lazy-loaded content
            await humanDelay(300, 800);
        }

        // Occasionally pause longer (like reading a product)
        if (Math.random() < 0.3) {
            await readingPause();
            await randomMouseMove(page);
        }
    }
}

// Scroll to bottom to load all content
async function scrollToBottom(page: PlaywrightPage): Promise<void> {
    let previousHeight = 0;
    let sameHeightCount = 0;
    let retries = 0;
    const maxRetries = 15;

    console.log(`[Scraper] scrollToBottom: starting scroll sequence (max ${maxRetries} retries)`);

    while (retries < maxRetries) {
        const currentHeight = await page.evaluate(() => document.body.scrollHeight);

        if (currentHeight === previousHeight) {
            sameHeightCount++;
            console.log(`[Scraper] scrollToBottom: height unchanged at ${currentHeight} (${sameHeightCount}/3)`);
            // Only stop after 3 consecutive same-height checks
            if (sameHeightCount >= 3) break;
        } else {
            console.log(`[Scraper] scrollToBottom: height changed ${previousHeight} -> ${currentHeight}`);
            sameHeightCount = 0;
        }
        previousHeight = currentHeight;

        // Scroll with varying amounts for natural behavior
        const scrollAmount = 400 + Math.floor(Math.random() * 500);
        await page.evaluate((amount: number) => {
            window.scrollBy({ top: amount, behavior: 'smooth' });
        }, scrollAmount);

        // Wait between scrolls
        await page.waitForTimeout(800 + Math.floor(Math.random() * 700));
        await humanDelay(800, 1500);

        // Every few scrolls, wait for network to settle (lazy loading)
        if (retries % 3 === 2) {
            try {
                await page.waitForLoadState('networkidle', { timeout: 5000 });
            } catch {
                // networkidle timeout is OK - just means no pending requests
            }
            await humanDelay(1500, 3000);
        }

        retries++;
    }

    // Final scroll to absolute bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        // OK if timeout
    }
    await humanDelay(1500, 3000);
    console.log(`[Scraper] scrollToBottom: completed after ${retries} retries, final height: ${previousHeight}`);
}

// --- Browser launch ---

async function launchBrowser(): Promise<PlaywrightBrowserContext> {
    // Sync cookies/session from real Edge profile
    await syncEdgeProfile();

    // eslint-disable-next-line no-eval
    const { chromium } = await eval("import('playwright')");
    const context = await chromium.launchPersistentContext(SCRAPER_USER_DATA, {
        channel: 'msedge',          // Use REAL Edge, not Chromium
        headless: false,
        args: [
            `--profile-directory=${EDGE_PROFILE}`,
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-infobars',
            '--window-size=1366,768',
            '--start-maximized',
        ],
        viewport: { width: 1366, height: 768 },
        locale: 'ko-KR',
        timezoneId: 'Asia/Seoul',
        // Do NOT set userAgent - let real Edge use its own
        ignoreDefaultArgs: ['--enable-automation'],
    });

    return context;
}

// --- Stealth injection ---

async function applyStealthToPage(page: PlaywrightPage): Promise<void> {
    await page.addInitScript(() => {
        // Remove webdriver flag
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });

        // Chrome runtime (Edge also has this since it's Chromium-based)
        // @ts-ignore
        if (!window.chrome) {
            // @ts-ignore
            window.chrome = {};
        }
        // @ts-ignore
        if (!window.chrome.runtime) {
            // @ts-ignore
            window.chrome.runtime = {
                connect: () => {},
                sendMessage: () => {},
            };
        }

        // Realistic plugins (Edge uses same plugins as Chromium)
        Object.defineProperty(navigator, 'plugins', {
            get: () => {
                return [
                    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
                    { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
                ];
            },
        });

        // Languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['ko-KR', 'ko', 'en-US', 'en'],
        });

        // Permissions
        const originalQuery = window.navigator.permissions.query.bind(window.navigator.permissions);
        // @ts-ignore
        window.navigator.permissions.query = (parameters: PermissionDescriptor) =>
            parameters.name === 'notifications'
                ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
                : originalQuery(parameters);

        // Hide automation-related properties
        // @ts-ignore
        delete navigator.__proto__.webdriver;

        // Canvas fingerprint protection - add small noise
        const originalGetContext = HTMLCanvasElement.prototype.getContext;
        // @ts-ignore
        HTMLCanvasElement.prototype.getContext = function(type, ...args) {
            // @ts-ignore
            const context = originalGetContext.apply(this, [type, ...args]);
            if (type === '2d' && context) {
                // @ts-ignore
                const originalGetImageData = context.getImageData;
                // @ts-ignore
                context.getImageData = function(...gdArgs) {
                    // @ts-ignore
                    const imageData = originalGetImageData.apply(this, gdArgs);
                    // Add tiny noise to a few pixels
                    for (let i = 0; i < 3; i++) {
                        const idx = Math.floor(Math.random() * imageData.data.length);
                        imageData.data[idx] = imageData.data[idx] ^ 1;
                    }
                    return imageData;
                };
            }
            return context;
        };

        // Connection type (real browsers have this)
        // @ts-ignore
        if (navigator.connection === undefined) {
            Object.defineProperty(navigator, 'connection', {
                get: () => ({
                    effectiveType: '4g',
                    rtt: 50,
                    downlink: 10,
                    saveData: false,
                }),
            });
        }

        // Hardware concurrency (match real system)
        Object.defineProperty(navigator, 'hardwareConcurrency', {
            get: () => 8,
        });

        // Device memory
        Object.defineProperty(navigator, 'deviceMemory', {
            get: () => 8,
        });

        // Platform
        Object.defineProperty(navigator, 'platform', {
            get: () => 'Win32',
        });
    });
}

// --- Natural search via direct URL or clipboard paste ---

async function searchViaCoupang(
    page: PlaywrightPage,
    query: string,
    options: ScrapeOptions
): Promise<void> {
    // Strategy 1: Direct URL navigation (avoids search bar bot detection)
    console.log(`[Scraper] Strategy 1: Direct URL navigation for "${query}"`);
    const directUrl = `https://www.coupang.com/np/search?q=${encodeURIComponent(query)}&channel=user&sorter=${options.sortBy || 'scoreDesc'}&listSize=36&page=1&rocketAll=false`;

    await page.goto(directUrl, {
        waitUntil: 'networkidle',
        timeout: 30000,
    });
    await readingPause();
    await randomMouseMove(page);

    // Check if we got blocked (Access Denied or CAPTCHA)
    const isBlocked = await page.evaluate(() => {
        const title = document.title.toLowerCase();
        const bodyText = document.body?.innerText?.toLowerCase() || '';
        return title.includes('access denied')
            || title.includes('denied')
            || title === ''
            || bodyText.includes('captcha')
            || bodyText.includes('보안 문자')
            || bodyText.includes('자동 입력 방지')
            || bodyText.includes('robot');
    });

    if (!isBlocked) {
        console.log(`[Scraper] Direct URL navigation succeeded`);
        await humanScroll(page);
        return;
    }

    // Strategy 2: Clipboard paste (fallback)
    console.log(`[Scraper] Strategy 1 blocked. Trying Strategy 2: Clipboard paste`);

    await page.goto('https://www.coupang.com', {
        waitUntil: 'networkidle',
        timeout: 30000,
    });
    await readingPause();
    await randomMouseMove(page);

    // Find and click search bar
    const searchInput = page.locator('input[name="q"]:visible').first();
    await searchInput.waitFor({ timeout: 10000 });
    await microPause();
    await searchInput.click();
    await microPause();

    // Clear existing text
    await searchInput.fill('');
    await microPause();

    // Use clipboard paste instead of keyboard.type()
    // This creates native clipboard events that are harder to detect
    await page.evaluate((text: string) => {
        navigator.clipboard.writeText(text).catch(() => {
            // Fallback: use execCommand
            const input = document.querySelector('input[name="q"]') as HTMLInputElement;
            if (input) {
                input.value = text;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }, query);

    // Try Ctrl+V paste
    await page.keyboard.down('Control');
    await page.keyboard.press('v');
    await page.keyboard.up('Control');
    await humanDelay(300, 800);

    // Verify text was pasted, if not use direct value setting
    const inputValue = await searchInput.inputValue();
    if (!inputValue || inputValue.length === 0) {
        console.log(`[Scraper] Clipboard paste failed, using direct input value setting`);
        await page.evaluate((text: string) => {
            const input = document.querySelector('input[name="q"]') as HTMLInputElement;
            if (input) {
                // Use native setter to bypass React/framework controlled inputs
                const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
                if (nativeSetter) {
                    nativeSetter.call(input, text);
                } else {
                    input.value = text;
                }
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, query);
        await microPause();
    }

    await humanDelay(500, 1500);

    // Press Enter to search
    await searchInput.press('Enter');
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    await readingPause();
    console.log(`[Scraper] Strategy 2 search completed`);
}

// --- Build URL for pagination (after initial search) ---

function buildSearchUrl(query: string, options: ScrapeOptions, pageNum: number): string {
    const params = new URLSearchParams();
    params.set('q', query);
    params.set('sorter', options.sortBy || 'salesCountDesc');
    if (options.minPrice) params.set('minPrice', options.minPrice.toString());
    if (options.maxPrice) params.set('maxPrice', options.maxPrice.toString());
    params.set('listSize', '36');
    params.set('page', pageNum.toString());
    params.set('rocketAll', 'true');
    return `https://www.coupang.com/np/search?${params.toString()}`;
}

// --- Apply sort/filter after initial search ---

async function applySortAndFilter(
    page: PlaywrightPage,
    options: ScrapeOptions,
    query: string
): Promise<void> {
    // Check if current URL already has the right params
    const currentUrl = page.url();
    const targetSorter = options.sortBy || 'salesCountDesc';
    if (currentUrl.includes(`sorter=${targetSorter}`)) {
        console.log(`[Scraper] Filters already applied, skipping`);
        await humanScroll(page);
        return;
    }

    // Navigate to filtered URL
    const filteredUrl = buildSearchUrl(query, options, 1);
    console.log(`[Scraper] Applying filters: ${filteredUrl}`);
    await page.goto(filteredUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await readingPause();

    // Verify products loaded
    const productCount = await page.locator('[class*="ProductUnit_productUnit__"], li[class*="search-product"], a[href*="/products/"]').count();
    console.log(`[Scraper] Products loaded after filter: ${productCount}`);
    if (productCount === 0) {
        await humanDelay(2000, 4000);
        const retryCount = await page.locator('[class*="ProductUnit_productUnit__"], li[class*="search-product"], a[href*="/products/"]').count();
        console.log(`[Scraper] Products after extra wait: ${retryCount}`);
    }

    await humanScroll(page);
}

// --- Extract products ---

async function extractProducts(page: PlaywrightPage, brand: string): Promise<ScrapedNotebook[]> {
    // Try multiple container selectors (Coupang changes DOM structure periodically)
    const containerSelectors = [
        '#product-list',
        '#productList',
        '[class*="search-product"]',
        '.search-content',
        '[id*="productList"]',
        '[class*="SearchResult"]',
        '[class*="searchResult"]',
        '#searchOptionForm',
    ];

    let containerFound = false;
    for (const selector of containerSelectors) {
        try {
            await page.waitForSelector(selector, { timeout: 3000 });
            console.log(`[Scraper] Found product container: ${selector}`);
            containerFound = true;
            break;
        } catch {
            // Try next selector
        }
    }

    if (!containerFound) {
        // Last resort: check if any product-like links exist on the page
        const productLinkCount = await page.evaluate(() =>
            document.querySelectorAll('a[href*="/products/"]').length
        );
        if (productLinkCount === 0) {
            console.log(`[Scraper] No product container found. Tried: ${containerSelectors.join(', ')}`);
            return [];
        }
        console.log(`[Scraper] No container matched, but found ${productLinkCount} product links. Proceeding.`);
    }

    // Scroll to load lazy images
    await scrollToBottom(page);
    await microPause();

    const result = await page.evaluate((brandName: string) => {
        // Helper: try multiple selectors, return first match
        function queryFirst(parent: Element, selectors: string[]): Element | null {
            for (const sel of selectors) {
                const el = parent.querySelector(sel);
                if (el) return el;
            }
            return null;
        }

        // Helper: try multiple selectors for text content
        function queryText(parent: Element, selectors: string[]): string {
            const el = queryFirst(parent, selectors);
            return el?.textContent?.trim() || '';
        }

        // Helper: extract numeric value from text
        function extractNumber(text: string): number {
            return parseInt(text.replace(/[^0-9]/g, '')) || 0;
        }

        const products: Array<Record<string, string | number | null>> = [];

        // Try multiple selectors for product list items
        const itemSelectors = [
            'li[class*="ProductUnit_productUnit__"]',
            'li.search-product',
            'li[class*="product-item"]',
            'li[class*="search-product"]',
            'li[class*="SearchProduct"]',
            'li[class*="baby-product"]',
            '#productList > li',
            '#product-list > li',
            '.search-content li[class]',
        ];

        let items: Element[] = [];
        let usedSelector = '';
        for (const sel of itemSelectors) {
            const found = document.querySelectorAll(sel);
            if (found.length > 0) {
                items = Array.from(found);
                usedSelector = sel;
                break;
            }
        }

        // Fallback: find all <li> elements that contain product links
        if (items.length === 0) {
            const allLinks = document.querySelectorAll('a[href*="/products/"]');
            const liSet = new Set<Element>();
            allLinks.forEach(link => {
                const li = link.closest('li');
                if (li) liSet.add(li);
            });
            if (liSet.size > 0) {
                items = Array.from(liSet);
                usedSelector = 'fallback: li from product links';
            }
        }

        if (items.length === 0) {
            return { products: [], debug: `No items found. Tried: ${itemSelectors.join(', ')}` };
        }

        for (const item of items) {
            try {
                // Skip ad items
                const adSelectors = [
                    '[class*="ad-badge"]', '[class*="Ad_"]', '[class*="adProduct"]',
                    '[class*="AdProduct"]', '[class*="sponsor"]', '[data-ad-id]', '[class*="ad_"]',
                ];
                const isAd = adSelectors.some(sel => item.querySelector(sel) !== null);
                const itemClasses = (item.className || '').toLowerCase();
                const isAdItem = itemClasses.includes('ad-product') || itemClasses.includes('adproduct') || itemClasses.includes('sponsor');
                if (isAd || isAdItem) continue;

                // Product link
                const linkEl = queryFirst(item, [
                    'a[href*="/products/"]',
                    'a[href*="/vp/products/"]',
                    'a[href*="coupang.com/vp/"]',
                ]);
                if (!linkEl) continue;

                const href = linkEl.getAttribute('href') || '';
                const url = href.startsWith('http') ? href : `https://www.coupang.com${href}`;

                // Product name (multiple fallback selectors)
                const productName = queryText(item, [
                    '[class*="ProductUnit_productNameV2__"]',
                    '[class*="ProductUnit_productName__"]',
                    '[class*="name"]',
                    '[class*="title"]',
                    '.name',
                    '.title',
                    'div[class*="Name"]',
                    'div[class*="productName"]',
                    'dd[class*="name"]',
                ]);
                if (!productName) continue;

                // Current price (multiple fallback selectors)
                const priceText = queryText(item, [
                    'strong[class*="Price_priceValue"]',
                    'strong[class*="price-value"]',
                    '[class*="price-value"]',
                    'strong.price-value',
                    'em.sale',
                    '[class*="PriceValue"]',
                    'strong[class*="price"]',
                    '[class*="sale-price"]',
                    'span.price',
                ]);
                const currentPrice = extractNumber(priceText);
                if (currentPrice === 0) continue;

                // Original/base price
                const origPriceText = queryText(item, [
                    'del[class*="PriceInfo_basePrice"]',
                    'del[class*="base-price"]',
                    'del.base-price',
                    'del',
                    '[class*="basePrice"]',
                    '[class*="original-price"]',
                    'span.origin-price',
                ]);
                const originalPrice = extractNumber(origPriceText) || currentPrice;

                // Discount rate
                const discountText = queryText(item, [
                    'span[class*="PriceInfo_discountRate"]',
                    'span[class*="discount-rate"]',
                    '[class*="discountRate"]',
                    '[class*="discount-percentage"]',
                    'span.discount-percentage',
                    'em.discount',
                ]);
                const discountRate = discountText || (
                    originalPrice > currentPrice
                        ? Math.round((1 - currentPrice / originalPrice) * 100) + '%'
                        : '0%'
                );

                // Rating
                const ratingText = queryText(item, [
                    '[class*="Rating_rating"]', '[class*="rating"]',
                    'em.rating', '[class*="star-rating"]', '.rating',
                ]);
                const rating = ratingText ? parseFloat(ratingText) : null;

                // Review count
                const reviewText = queryText(item, [
                    '[class*="Review_count"]', '[class*="review"]',
                    'span.rating-total-count', '[class*="reviewCount"]',
                    '[class*="ratingCount"]', '.count',
                ]);
                const reviewNum = extractNumber(reviewText);
                const reviewCount = reviewNum > 0 ? reviewNum : null;

                // Monthly purchases
                const purchaseText = queryText(item, [
                    '[class*="SaleCount"]', '[class*="saleCount"]',
                    '[class*="sold"]', '[class*="purchase"]', '[class*="buying"]',
                ]);
                const purchaseNum = extractNumber(purchaseText);
                const monthlyPurchases = purchaseNum > 0 ? purchaseNum : null;

                // Thumbnail image
                const imgEl = queryFirst(item, [
                    'figure[class*="ProductUnit_productImage"] img',
                    'img[alt]', 'img[src*="thumbnail"]', 'img[src*="product"]',
                    'img[class*="product"]', 'img.search-product-wrap-img', 'dt img', 'img',
                ]);
                const thumbnailUrl = imgEl?.getAttribute('src')
                    || imgEl?.getAttribute('data-img-src')
                    || imgEl?.getAttribute('data-src')
                    || null;

                products.push({
                    url,
                    productName,
                    currentPrice,
                    originalPrice,
                    discountRate,
                    rating,
                    reviewCount,
                    monthlyPurchases,
                    brand: brandName,
                    thumbnailUrl,
                });
            } catch {
                // Skip malformed product entries
            }
        }

        return {
            products,
            debug: `Selector: ${usedSelector}, items: ${items.length}, extracted: ${products.length}`,
        };
    }, brand);

    console.log(`[Scraper] Extraction: ${result.debug}`);
    return result.products;
}

// --- Main scrape function ---

export async function scrapeNotebooks(
    brandParam: string,
    brandName: string,
    options: ScrapeOptions
): Promise<ScrapedNotebook[]> {
    const maxPages = options.maxPages || 5;
    const allProducts: ScrapedNotebook[] = [];
    let context: PlaywrightBrowserContext | null = null;

    try {
        context = await launchBrowser();
        const page = context.pages()[0] || await context.newPage();
        await applyStealthToPage(page);

        // Set extra headers to look more natural
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            'sec-ch-ua': '"Microsoft Edge";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
        });

        // Support direct queries (e.g., "lg그램") or append product type
        const productKeywords = ['노트북', '그램', '갤럭시북', '맥북', 'gram', 'macbook', 'thinkpad', 'zenbook'];
        const hasProductType = productKeywords.some(k => brandParam.toLowerCase().includes(k.toLowerCase()));
        const searchQuery = hasProductType ? brandParam : `${brandParam} 노트북`;

        // Page 1: Natural search via search bar
        console.log(`[Scraper] ${brandName} - Searching: "${searchQuery}" (brandParam: "${brandParam}", hasProductType: ${hasProductType})`);
        await searchViaCoupang(page, searchQuery, options);

        // Apply sort and price filter
        await applySortAndFilter(page, options, searchQuery);

        // Extract page 1
        const page1Products = await extractProducts(page, brandName);
        console.log(`[Scraper] ${brandName} - Page 1: Found ${page1Products.length} products`);
        allProducts.push(...page1Products);

        // Pages 2+: Navigate via URL (natural after initial search)
        for (let pageNum = 2; pageNum <= maxPages; pageNum++) {
            if (allProducts.length >= options.batchSize) break;
            if (page1Products.length === 0 && pageNum === 2) break;

            await navigationPause();
            await randomMouseMove(page);

            const url = buildSearchUrl(searchQuery, options, pageNum);
            console.log(`[Scraper] ${brandName} - Page ${pageNum}: navigating to ${url}`);

            await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
            await readingPause();
            await humanScroll(page);

            const pageProducts = await extractProducts(page, brandName);
            console.log(`[Scraper] ${brandName} - Page ${pageNum}: Found ${pageProducts.length} products`);

            if (pageProducts.length === 0) break;
            allProducts.push(...pageProducts);
        }
    } catch (error) {
        console.error(`[Scraper] Error scraping ${brandName}:`, error);
    } finally {
        if (context) {
            await context.close().catch(() => {});
        }
    }

    return allProducts.slice(0, options.batchSize);
}

export async function closeBrowser(context: PlaywrightBrowserContext): Promise<void> {
    try {
        await context.close();
    } catch {
        // Ignore
    }
}
