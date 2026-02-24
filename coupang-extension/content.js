// Content Script - 쿠팡 제품 페이지에서 데이터 추출 및 Supabase 저장
(async function () {
    'use strict';

    // ========== Supabase 설정 ==========
    const SUPABASE_URL = 'https://rmbowbqxdryndsekobmh.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtYm93YnF4ZHJ5bmRzZWtvYm1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MjQ1NTAsImV4cCI6MjA4MzQwMDU1MH0.zbY__R1s7RLLSWEgmJfTYXSVz_G64sLIZEN1j5YpwKc';

    // ========== Storage 캐시 (chrome.storage.local은 비동기) ==========
    let _cache = {};

    async function initStorage() {
        const data = await chrome.storage.local.get(null);
        _cache = data || {};
        console.log('[Coupang Tracker] Storage loaded, keys:', Object.keys(_cache));
    }

    function getValue(key, defaultValue) {
        return (key in _cache) ? _cache[key] : defaultValue;
    }

    function setValue(key, value) {
        _cache[key] = value;
        chrome.storage.local.set({ [key]: value });
    }

    // Storage 초기화 대기
    await initStorage();

    let AUTH_TOKEN = getValue('auth_token', null);

    console.log('[Coupang Tracker] 스크립트 시작!');
    console.log('[Coupang Tracker] AUTH_TOKEN:', AUTH_TOKEN ? 'present' : 'missing');

    // ========== 제품 페이지 확인 ==========
    function isProductPage() {
        return window.location.href.includes('/vp/products/') ||
            window.location.href.includes('/products/');
    }

    if (!isProductPage()) {
        console.log('[Coupang Tracker] 제품 페이지가 아님, 종료');
        return;
    }

    console.log('[Coupang Tracker] 제품 페이지 감지!');

    // ========== JWT 토큰 만료 확인 ==========
    function isTokenExpiredOrSoon() {
        if (!AUTH_TOKEN || !AUTH_TOKEN.access_token) return true;
        try {
            const parts = AUTH_TOKEN.access_token.split('.');
            if (parts.length !== 3) return true;
            const payload = JSON.parse(atob(parts[1]));
            const expiresIn = payload.exp - Math.floor(Date.now() / 1000);
            console.log('[Coupang Tracker] 토큰 만료까지:', expiresIn + '초');
            return expiresIn < 300;
        } catch (e) {
            return true;
        }
    }

    // ========== 토큰 갱신 ==========
    async function refreshAccessToken() {
        const refreshToken = AUTH_TOKEN?.refresh_token;
        if (!refreshToken) return false;

        console.log('[Coupang Tracker] 토큰 갱신 중...');
        try {
            const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refresh_token: refreshToken })
            });
            const data = await res.json();
            if (data.access_token) {
                AUTH_TOKEN = {
                    access_token: data.access_token,
                    refresh_token: data.refresh_token || refreshToken,
                    user: data.user || AUTH_TOKEN.user
                };
                setValue('auth_token', AUTH_TOKEN);
                console.log('[Coupang Tracker] 토큰 갱신 성공!');
                showNotification('🔄 토큰 갱신됨', '인증이 자동 갱신되었습니다');
                return true;
            }
        } catch (e) {
            console.log('[Coupang Tracker] 토큰 갱신 에러:', e);
        }
        return false;
    }

    // ========== 알림 표시 ==========
    function showNotification(title, text, isSuccess = true) {
        const existing = document.getElementById('coupang-tracker-notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.id = 'coupang-tracker-notification';
        notification.style.cssText = `
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            background: ${isSuccess ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#ef4444'} !important;
            color: white !important;
            padding: 16px 24px !important;
            border-radius: 12px !important;
            z-index: 2147483647 !important;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif !important;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3) !important;
            max-width: 350px !important;
            font-size: 14px !important;
        `;
        notification.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 4px;">${title}</div>
            <div style="font-size: 12px; opacity: 0.9; white-space: pre-line;">${text}</div>
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    }

    // ========== 데이터 추출 ==========
    function extractProductData() {
        const nameEl = document.querySelector('h1.product-title span.twc-font-bold') ||
            document.querySelector('h1.product-title') ||
            document.querySelector('.prod-buy-header__title');
        const productName = nameEl ? nameEl.textContent.trim() : document.title.split(' - ')[0];

        const priceEl = document.querySelector('.final-price-amount') ||
            document.querySelector('.price-amount.final-price-amount') ||
            document.querySelector('.prod-sale-price strong');
        let currentPrice = 0;
        if (priceEl) {
            currentPrice = parseInt(priceEl.textContent.replace(/[^0-9]/g, '')) || 0;
        }

        const allPrices = document.querySelectorAll('.price-amount');
        let originalPrice = currentPrice;
        allPrices.forEach(el => {
            const p = parseInt(el.textContent.replace(/[^0-9]/g, ''));
            if (p > originalPrice) originalPrice = p;
        });

        let discountRate = '0%';
        if (originalPrice > currentPrice && currentPrice > 0) {
            discountRate = Math.round((1 - currentPrice / originalPrice) * 100) + '%';
        }

        // 별점
        let rating = null;
        const ratingDiv = document.querySelector('.review-atf div[aria-label]');
        if (ratingDiv) rating = parseFloat(ratingDiv.getAttribute('aria-label')) || null;
        if (!rating) {
            const stars = document.querySelectorAll('.review-atf svg');
            if (stars.length > 0) rating = stars.length;
        }

        // 리뷰 수
        let reviewCount = null;
        const reviewAtf = document.querySelector('.review-atf');
        if (reviewAtf) {
            const match = reviewAtf.textContent.match(/\((\d+(?:,\d+)*)\)/);
            if (match) reviewCount = parseInt(match[1].replace(/,/g, '')) || null;
        }

        // 월간 구매수
        let monthlyPurchases = null;
        const allElements = document.querySelectorAll('p, span, div, strong, em');
        for (const el of allElements) {
            const text = el.textContent?.trim() || '';
            if (text.includes('구매') || text.includes('명이') || text.includes('한 달')) {
                let match = text.match(/(\d+(?:,\d+)*)\s*명/);
                if (match) { monthlyPurchases = parseInt(match[1].replace(/,/g, '')) || null; if (monthlyPurchases) break; }
                match = text.match(/(\d+(?:,\d+)*)\+/);
                if (match) { monthlyPurchases = parseInt(match[1].replace(/,/g, '')) || null; if (monthlyPurchases) break; }
            }
        }

        return {
            url: window.location.href.split('?')[0],
            product_name: productName,
            current_price: currentPrice,
            original_price: originalPrice,
            discount_rate: discountRate,
            rating, review_count: reviewCount, monthly_purchases: monthlyPurchases
        };
    }

    // ========== Supabase에 저장 ==========
    async function saveToSupabase(productData, isRetry = false) {
        if (!AUTH_TOKEN?.access_token) {
            showNotification('🔑 인증 필요', 'YGIF에서 로그인 후 다시 시도해주세요', false);
            return;
        }

        const userId = AUTH_TOKEN.user?.id;
        const accessToken = AUTH_TOKEN.access_token;
        if (!userId || !accessToken) {
            showNotification('❌ 인증 오류', 'user.id 또는 access_token 없음', false);
            return;
        }

        const headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        };

        try {
            // 기존 제품 확인
            const checkRes = await fetch(
                `${SUPABASE_URL}/rest/v1/products?url=eq.${encodeURIComponent(productData.url)}&user_id=eq.${userId}&select=*`,
                { headers }
            );

            if (checkRes.status === 401 && !isRetry) {
                console.log('[Coupang Tracker] 401, 토큰 갱신 시도');
                const refreshed = await refreshAccessToken();
                if (refreshed) return saveToSupabase(productData, true);
                stopUpdateAndGoBack('인증 만료: YGIF에서 다시 로그인해주세요');
                return;
            }

            const existing = await checkRes.json();

            if (existing && existing.length > 0) {
                // 업데이트
                const ep = existing[0];
                let priceChange = '0%';
                if (ep.current_price > 0) {
                    const pct = ((productData.current_price - ep.current_price) / ep.current_price * 100);
                    priceChange = (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
                }

                const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${ep.id}`, {
                    method: 'PATCH',
                    headers: { ...headers, 'Prefer': 'return=minimal' },
                    body: JSON.stringify({
                        product_name: productData.product_name,
                        current_price: productData.current_price,
                        original_price: productData.original_price,
                        discount_rate: productData.discount_rate,
                        previous_price: ep.current_price,
                        price_change_rate: priceChange,
                        rating: productData.rating,
                        review_count: productData.review_count,
                        monthly_purchases: productData.monthly_purchases,
                        last_updated: new Date().toISOString()
                    })
                });

                if (patchRes.ok) {
                    const changeText = priceChange === '0%' ? '변동 없음' : `전일대비 ${priceChange}`;
                    showNotification('✅ 가격 업데이트됨',
                        `${productData.product_name.substring(0, 25)}...\n💰 ${productData.current_price.toLocaleString()}원\n📊 ${changeText}`);
                    await savePriceHistory(ep.id, productData.current_price, accessToken);
                } else {
                    stopUpdateAndGoBack('업데이트 실패');
                    return;
                }
            } else {
                // 새로 추가
                const postRes = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
                    method: 'POST',
                    headers: { ...headers, 'Prefer': 'return=representation' },
                    body: JSON.stringify({
                        user_id: userId,
                        url: productData.url,
                        product_name: productData.product_name,
                        current_price: productData.current_price,
                        original_price: productData.original_price,
                        discount_rate: productData.discount_rate,
                        rating: productData.rating,
                        review_count: productData.review_count,
                        monthly_purchases: productData.monthly_purchases,
                        last_updated: new Date().toISOString()
                    })
                });

                if (postRes.ok) {
                    showNotification('✅ 제품 추가됨',
                        `${productData.product_name.substring(0, 25)}...\n💰 ${productData.current_price.toLocaleString()}원`);
                    try {
                        const newProduct = await postRes.json();
                        if (newProduct?.[0]?.id) {
                            await savePriceHistory(newProduct[0].id, productData.current_price, accessToken);
                        }
                    } catch (e) { /* ignore */ }
                } else {
                    stopUpdateAndGoBack('추가 실패');
                    return;
                }
            }

            // 성공 → 뒤로 가기
            goBackToYGIF();

        } catch (err) {
            console.error('[Coupang Tracker] 네트워크 에러:', err);
            stopUpdateAndGoBack('네트워크 에러: ' + err.message);
        }
    }

    // ========== 가격 히스토리 저장 ==========
    async function savePriceHistory(productId, price, accessToken) {
        const today = new Date().toISOString().split('T')[0];
        const headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        };

        try {
            const checkRes = await fetch(
                `${SUPABASE_URL}/rest/v1/price_history?product_id=eq.${productId}&recorded_date=eq.${today}&select=id`,
                { headers }
            );
            const existing = await checkRes.json();

            if (existing?.length > 0) {
                await fetch(`${SUPABASE_URL}/rest/v1/price_history?id=eq.${existing[0].id}`, {
                    method: 'PATCH',
                    headers: { ...headers, 'Prefer': 'return=minimal' },
                    body: JSON.stringify({ price })
                });
            } else {
                await fetch(`${SUPABASE_URL}/rest/v1/price_history`, {
                    method: 'POST',
                    headers: { ...headers, 'Prefer': 'return=minimal' },
                    body: JSON.stringify({ product_id: productId, price, recorded_date: today })
                });
            }
            console.log('[Coupang Tracker] ✅ 가격 히스토리 저장됨');
        } catch (e) {
            console.log('[Coupang Tracker] 가격 히스토리 저장 에러:', e);
        }
    }

    // ========== 뒤로 가기 ==========
    function goBackToYGIF() {
        console.log('[Coupang Tracker] 저장 완료, 2초 후 뒤로 가기...');
        setTimeout(() => window.history.back(), 2000);
    }

    function stopUpdateAndGoBack(errorMessage) {
        console.log('[Coupang Tracker] 업데이트 중단:', errorMessage);
        showNotification('❌ 업데이트 중단', errorMessage + '\n\nYGIF로 돌아갑니다...', false);
        setTimeout(() => { window.location.href = 'http://localhost:3000/coupang'; }, 5000);
    }

    // ========== 메인 실행 (3초 대기 후) ==========
    setTimeout(async () => {
        const productData = extractProductData();
        console.log('[Coupang Tracker] 추출 데이터:', productData);

        if (productData.current_price > 0) {
            if (isTokenExpiredOrSoon()) {
                const refreshed = await refreshAccessToken();
                if (!refreshed) {
                    stopUpdateAndGoBack('인증 만료: YGIF에서 다시 로그인해주세요');
                    return;
                }
            }
            await saveToSupabase(productData);
        } else {
            showNotification('⚠️ 가격 없음', '가격 정보를 찾을 수 없습니다.\n5초 후 뒤로 돌아갑니다...', false);
            setTimeout(() => window.history.back(), 5000);
        }
    }, 3000);
})();
