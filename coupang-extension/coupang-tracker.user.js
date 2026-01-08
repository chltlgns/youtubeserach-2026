// ==UserScript==
// @name         Coupang Price Tracker (Auto-Save)
// @namespace    http://tampermonkey.net/
// @version      2.3
// @description  쿠팡 제품 페이지 방문 시 가격 데이터를 Supabase에 자동 저장 (순차 업데이트 지원)
// @author       YGIF
// @match        *://*.coupang.com/*
// @match        http://localhost:3000/*
// @match        http://127.0.0.1:3000/*
// @run-at       document-end
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_notification
// @grant        unsafeWindow
// @connect      rmbowbqxdryndsekobmh.supabase.co
// ==/UserScript==

(function () {
    'use strict';

    console.log('[Coupang Tracker] 스크립트 시작!');

    // ========== Supabase 설정 ==========
    const SUPABASE_URL = 'https://rmbowbqxdryndsekobmh.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtYm93YnF4ZHJ5bmRzZWtvYm1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MjQ1NTAsImV4cCI6MjA4MzQwMDU1MH0.zbY__R1s7RLLSWEgmJfTYXSVz_G64sLIZEN1j5YpwKc';

    // ========== 인증 토큰 ==========
    let AUTH_TOKEN = GM_getValue('auth_token', null) || {
        "access_token": "eyJhbGciOiJFUzI1NiIsImtpZCI6ImFhY2ZkZGM4LWQwY2QtNDIzOC1iNjg1LTJhN2Y4OTVkMmI1OSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3JtYm93YnF4ZHJ5bmRzZWtvYm1oLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI4OGM0ZDg5OC0yNGRjLTQwMDMtYWVkMC0yZmU0M2Q1YjM5MDUiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzY3ODUzMzc5LCJpYXQiOjE3Njc4NDk3NzksImVtYWlsIjoiY2hsdGxnbnM5MjBAZ21haWwuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJlbWFpbCI6ImNobHRsZ25zOTIwQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInN1YiI6Ijg4YzRkODk4LTI0ZGMtNDAwMy1hZWQwLTJmZTQzZDViMzkwNSJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzY3ODQ5Nzc5fV0sInNlc3Npb25faWQiOiI5MGU1MjFkMS1kZWJhLTRjNmMtYWExYy02NDA4NjAxOTlhZGIiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.zKt9tmJVj_9Ej1qCJL53bbjL0_blm2H6JB2JbfBKq2xpHOiwLF4mkbT6bbVpIpV6QTG6BelZLDTWD18YyFngcg",
        "refresh_token": "rafmhkvatp5j",
        "user": {
            "id": "88c4d898-24dc-4003-aed0-2fe43d5b3905"
        }
    };
    // =============================================

    // YGIF 업데이트 큐 확인 (GM_getValue 사용 - 도메인 무관)
    function checkUpdateQueue() {
        try {
            const queueStr = GM_getValue('coupang_update_queue', null);
            const currentIndex = GM_getValue('coupang_update_index', -1);
            if (queueStr && currentIndex >= 0) {
                const urls = typeof queueStr === 'string' ? JSON.parse(queueStr) : queueStr;
                return {
                    urls: urls,
                    currentIndex: currentIndex,
                    hasQueue: true
                };
            }
        } catch (e) {
            console.log('[Coupang Tracker] 큐 체크 에러:', e);
        }
        return { hasQueue: false };
    }

    // 큐 설정 (YGIF에서 호출)
    function setUpdateQueue(urls) {
        GM_setValue('coupang_update_queue', urls);
        GM_setValue('coupang_update_index', 0);
        console.log('[Coupang Tracker] 큐 설정됨:', urls.length, '개');
    }

    // 뒤로 가기로 YGIF로 돌아가기 (저장 완료 후)
    function goBackToYGIF() {
        console.log('[Coupang Tracker] 데이터 저장 완료, 뒤로 가기로 YGIF로 돌아갑니다...');

        setTimeout(() => {
            // 브라우저 뒤로 가기
            window.history.back();
        }, 2000);
    }

    // 토큰 갱신
    function refreshAccessToken(callback) {
        const refreshToken = AUTH_TOKEN.refresh_token;
        if (!refreshToken) {
            console.log('[Coupang Tracker] refresh_token 없음');
            callback(false);
            return;
        }

        console.log('[Coupang Tracker] 토큰 갱신 중...');

        GM_xmlhttpRequest({
            method: 'POST',
            url: `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
            },
            data: JSON.stringify({
                refresh_token: refreshToken
            }),
            onload: function (response) {
                try {
                    const data = JSON.parse(response.responseText);
                    if (data.access_token) {
                        AUTH_TOKEN = {
                            access_token: data.access_token,
                            refresh_token: data.refresh_token || refreshToken,
                            user: data.user || AUTH_TOKEN.user
                        };
                        GM_setValue('auth_token', AUTH_TOKEN);
                        console.log('[Coupang Tracker] 토큰 갱신 성공!');
                        showNotification('🔄 토큰 갱신됨', '인증이 자동 갱신되었습니다');
                        callback(true);
                    } else {
                        console.log('[Coupang Tracker] 토큰 갱신 실패:', data);
                        callback(false);
                    }
                } catch (e) {
                    console.log('[Coupang Tracker] 토큰 갱신 에러:', e);
                    callback(false);
                }
            },
            onerror: function (err) {
                console.log('[Coupang Tracker] 토큰 갱신 네트워크 에러:', err);
                callback(false);
            }
        });
    }

    // 제품 페이지인지 확인
    function isProductPage() {
        return window.location.href.includes('/vp/products/') ||
            window.location.href.includes('/products/');
    }

    // 데이터 추출
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

        // 별점 추출 (예: 4.5)
        let rating = null;
        const ratingEl = document.querySelector('.rating-star-container .rating') ||
            document.querySelector('.prod-review-rate span:first-child');
        if (ratingEl) {
            const ratingText = ratingEl.textContent.trim();
            rating = parseFloat(ratingText) || null;
        }
        // 별 개수로 추출 시도
        if (!rating) {
            const stars = document.querySelectorAll('.rating-star-container .star-on, .rating-star .fill');
            if (stars.length > 0) {
                rating = stars.length;
            }
        }

        // 리뷰 수 추출 (예: (538))
        let reviewCount = null;
        const reviewEl = document.querySelector('.rating-star-container .count') ||
            document.querySelector('.rating-star-container span:last-child') ||
            document.querySelector('.prod-review-rate > .count');
        if (reviewEl) {
            const countText = reviewEl.textContent.replace(/[^0-9]/g, '');
            reviewCount = parseInt(countText) || null;
        }

        // 월간 구매수 추출 (예: "400명 이상 만족했어요")
        let monthlyPurchases = null;
        const satisfactionEl = document.querySelector('.like-text') ||
            document.querySelector('.prod-satisfaction span');
        if (satisfactionEl) {
            const text = satisfactionEl.textContent;
            const match = text.match(/(\d+)명/);
            if (match) {
                monthlyPurchases = parseInt(match[1]) || null;
            }
        }

        return {
            url: window.location.href.split('?')[0],
            product_name: productName,
            current_price: currentPrice,
            original_price: originalPrice,
            discount_rate: discountRate,
            rating: rating,
            review_count: reviewCount,
            monthly_purchases: monthlyPurchases
        };
    }


    // 알림 표시
    function showNotification(title, text, isSuccess = true) {
        // 기존 알림 제거
        const existing = document.getElementById('coupang-tracker-notification');
        if (existing) existing.remove();

        const queue = checkUpdateQueue();
        const queueInfo = queue.hasQueue ? `\n\n📋 ${queue.currentIndex + 1}/${queue.urls.length} 진행 중` : '';

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
            <div style="font-size: 12px; opacity: 0.9; white-space: pre-line;">${text}${queueInfo}</div>
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    }

    // Supabase에 저장 (재시도 로직 포함)
    function saveToSupabase(productData, isRetry = false) {
        if (!AUTH_TOKEN || !AUTH_TOKEN.access_token) {
            showNotification('🔑 인증 필요', '토큰이 없습니다', false);
            return;
        }

        const userId = AUTH_TOKEN.user?.id;
        const accessToken = AUTH_TOKEN.access_token;

        if (!userId || !accessToken) {
            showNotification('❌ 인증 오류', 'user.id 또는 access_token 없음', false);
            return;
        }

        // 기존 제품 확인
        GM_xmlhttpRequest({
            method: 'GET',
            url: `${SUPABASE_URL}/rest/v1/products?url=eq.${encodeURIComponent(productData.url)}&user_id=eq.${userId}&select=*`,
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            onload: function (response) {
                // 401 에러 시 토큰 갱신 후 재시도
                if (response.status === 401 && !isRetry) {
                    console.log('[Coupang Tracker] 401 에러, 토큰 갱신 시도');
                    refreshAccessToken(function (success) {
                        if (success) {
                            saveToSupabase(productData, true);
                        } else {
                            showNotification('❌ 인증 만료', 'YGIF에서 다시 로그인해주세요', false);
                        }
                    });
                    return;
                }

                let existing = [];
                try {
                    existing = JSON.parse(response.responseText);
                } catch (e) { }

                if (existing && existing.length > 0) {
                    // 업데이트
                    const existingProduct = existing[0];
                    let priceChange = '0%';
                    if (existingProduct.current_price > 0) {
                        const changePercent = ((productData.current_price - existingProduct.current_price) / existingProduct.current_price * 100);
                        priceChange = (changePercent >= 0 ? '+' : '') + changePercent.toFixed(1) + '%';
                    }

                    GM_xmlhttpRequest({
                        method: 'PATCH',
                        url: `${SUPABASE_URL}/rest/v1/products?id=eq.${existingProduct.id}`,
                        headers: {
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=minimal'
                        },
                        data: JSON.stringify({
                            product_name: productData.product_name,
                            current_price: productData.current_price,
                            original_price: productData.original_price,
                            discount_rate: productData.discount_rate,
                            previous_price: existingProduct.current_price,
                            price_change_rate: priceChange,
                            rating: productData.rating,
                            review_count: productData.review_count,
                            monthly_purchases: productData.monthly_purchases,
                            last_updated: new Date().toISOString()
                        }),
                        onload: function (res) {
                            if (res.status >= 200 && res.status < 300) {
                                const changeText = priceChange === '0%' ? '변동 없음' : `전일대비 ${priceChange}`;
                                showNotification(
                                    '✅ 가격 업데이트됨',
                                    `${productData.product_name.substring(0, 25)}...\n💰 ${productData.current_price.toLocaleString()}원\n📊 ${changeText}`
                                );
                                // 저장 완료 - 뒤로 가기
                                goBackToYGIF();
                            } else {
                                showNotification('❌ 업데이트 실패', res.responseText.substring(0, 100), false);
                            }
                        }
                    });
                } else {
                    // 새로 추가
                    GM_xmlhttpRequest({
                        method: 'POST',
                        url: `${SUPABASE_URL}/rest/v1/products`,
                        headers: {
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=minimal'
                        },
                        data: JSON.stringify({
                            user_id: userId,
                            url: productData.url,
                            product_name: productData.product_name,
                            current_price: productData.current_price,
                            original_price: productData.original_price,
                            discount_rate: productData.discount_rate,
                            previous_price: null,
                            price_change_rate: null,
                            rating: productData.rating,
                            review_count: productData.review_count,
                            monthly_purchases: productData.monthly_purchases,
                            last_updated: new Date().toISOString()
                        }),
                        onload: function (res) {
                            if (res.status >= 200 && res.status < 300) {
                                showNotification(
                                    '✅ 제품 추가됨',
                                    `${productData.product_name.substring(0, 25)}...\n💰 ${productData.current_price.toLocaleString()}원`
                                );
                                // 저장 완료 - 뒤로 가기
                                goBackToYGIF();
                            } else {
                                showNotification('❌ 추가 실패', res.responseText.substring(0, 100), false);
                            }
                        }
                    });
                }
            }
        });
    }

    // YGIF 페이지인지 확인
    function isYGIFPage() {
        return window.location.href.includes('localhost:3000') ||
            window.location.href.includes('127.0.0.1:3000');
    }

    // YGIF에서 순차 업데이트 시작 버튼 추가
    function setupYGIFIntegration() {
        console.log('[Coupang Tracker] YGIF 페이지 감지, 통합 설정 중...');

        // CustomEvent 리스너 (YGIF에서 이벤트 발생 시 처리)
        document.addEventListener('startCoupangUpdate', function (e) {
            const urls = e.detail.urls;
            if (!urls || urls.length === 0) {
                alert('업데이트할 제품이 없습니다.');
                return;
            }

            GM_setValue('coupang_update_queue', urls);
            GM_setValue('coupang_update_index', 0);

            console.log('[Coupang Tracker] 큐 설정됨:', urls.length, '개');
            console.log('[Coupang Tracker] 첫 번째 제품으로 이동:', urls[0]);

            // 첫 번째 제품으로 이동
            window.location.href = urls[0];
        });

        // 준비 완료 신호 보내기
        document.dispatchEvent(new CustomEvent('coupangTrackerReady'));

        // updated=true 파라미터 확인 시 알림
        if (window.location.search.includes('updated=true')) {
            setTimeout(() => {
                alert('✅ 모든 제품 업데이트 완료!');
                // URL에서 파라미터 제거
                window.history.replaceState({}, '', window.location.pathname);
                // 데이터 새로고침을 위해 페이지 리로드
                window.location.reload();
            }, 500);
        }

        console.log('[Coupang Tracker] YGIF 통합 완료 - CustomEvent "startCoupangUpdate" 대기 중');
    }

    // 메인
    function main() {
        // YGIF 페이지인 경우
        if (isYGIFPage()) {
            setupYGIFIntegration();
            return;
        }

        // 쿠팡 제품 페이지인 경우
        if (!isProductPage()) {
            console.log('[Coupang Tracker] 제품 페이지가 아님');
            return;
        }

        console.log('[Coupang Tracker] 제품 페이지 감지!');
        const productData = extractProductData();
        console.log('[Coupang Tracker] 추출 데이터:', productData);

        if (productData.current_price > 0) {
            saveToSupabase(productData);
        } else {
            showNotification('⚠️ 가격 없음', '가격 정보를 찾을 수 없습니다', false);
        }
    }

    setTimeout(main, 3000);
})();
