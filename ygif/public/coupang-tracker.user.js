// ==UserScript==
// @name         Price Tracker (Coupang + 11st)
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  쿠팡/11번가 제품 페이지 방문 시 가격 데이터를 Supabase에 자동 저장 (순차 업데이트 지원)
// @author       YGIF
// @match        *://*.coupang.com/*
// @match        *://*.11st.co.kr/*
// @match        http://localhost:3000/*
// @match        http://127.0.0.1:3000/*
// @match        https://ygif-pied.vercel.app/*
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

    // ========== 봇 탐지 회피 유틸리티 ==========
    function randomBetween(min, max) {
        return min + Math.floor(Math.random() * (max - min + 1));
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 스크롤 시뮬레이션 (2~4회, 랜덤 거리)
    async function simulateHumanScroll() {
        const scrollCount = randomBetween(2, 4);
        for (let i = 0; i < scrollCount; i++) {
            window.scrollBy({ top: randomBetween(100, 500), behavior: 'smooth' });
            await sleep(randomBetween(300, 1200));
        }
        // 30% 확률로 위로 스크롤
        if (Math.random() < 0.3) {
            window.scrollBy({ top: -randomBetween(50, 200), behavior: 'smooth' });
            await sleep(randomBetween(200, 800));
        }
    }

    // 마우스 이동 시뮬레이션 (2~3회)
    async function simulateMouseMovement() {
        const moveCount = randomBetween(2, 3);
        for (let i = 0; i < moveCount; i++) {
            document.dispatchEvent(new MouseEvent('mousemove', {
                clientX: randomBetween(100, window.innerWidth - 100),
                clientY: randomBetween(100, window.innerHeight - 100),
                bubbles: true
            }));
            await sleep(randomBetween(200, 600));
        }
    }
    // 이미지 상호작용 시뮬레이션
    async function simulateImageInteraction() {
        const img = document.querySelector('.prod-image img') || document.querySelector('.prod-image__item img');
        if (img) {
            img.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await sleep(randomBetween(300, 800));
        }
    }

    // 리뷰 섹션까지 스크롤
    async function simulateScrollToReviews() {
        const reviewSection = document.querySelector('.js-reviewArticleListContainer') || document.querySelector('#btfTab');
        if (reviewSection) {
            reviewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            await sleep(randomBetween(500, 1500));
        }
    }

    // 탭 클릭 시뮬레이션
    async function simulateTabClick() {
        const tabs = document.querySelectorAll('.tab-titles .tab-title');
        if (tabs.length > 0) {
            const randomTab = tabs[Math.floor(Math.random() * tabs.length)];
            randomTab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await sleep(randomBetween(300, 1000));
        }
    }

    // ========== 행동 패턴 정의 ==========
    const behaviorPatterns = [
        {
            name: 'A: 빠른 확인',
            weight: 30,
            execute: async function () {
                await sleep(randomBetween(1000, 2500));
                await simulateHumanScroll();
                await simulateMouseMovement();
            },
            stayTime: function () { return randomBetween(2000, 5000); }
        },
        {
            name: 'B: 꼼꼼히 보기',
            weight: 25,
            execute: async function () {
                await sleep(randomBetween(2000, 4000));
                await simulateHumanScroll();
                await simulateImageInteraction();
                await simulateTabClick();
                await simulateHumanScroll();
                await simulateMouseMovement();
            },
            stayTime: function () { return randomBetween(6000, 15000); }
        },
        {
            name: 'C: 비교 쇼핑',
            weight: 30,
            execute: async function () {
                await sleep(randomBetween(1500, 3000));
                await simulateHumanScroll();
                await simulateScrollToReviews();
                await simulateMouseMovement();
                if (Math.random() < 0.4) {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    await sleep(randomBetween(500, 1500));
                }
            },
            stayTime: function () { return randomBetween(4000, 10000); }
        },
        {
            name: 'D: 우연히 방문',
            weight: 15,
            execute: async function () {
                await sleep(randomBetween(500, 1500));
                if (Math.random() < 0.5) {
                    window.scrollBy({ top: randomBetween(50, 200), behavior: 'smooth' });
                    await sleep(randomBetween(200, 600));
                }
            },
            stayTime: function () { return randomBetween(1000, 3000); }
        }
    ];

    function selectBehaviorPattern() {
        const totalWeight = behaviorPatterns.reduce((sum, p) => sum + p.weight, 0);
        let rand = Math.random() * totalWeight;
        for (const pattern of behaviorPatterns) {
            rand -= pattern.weight;
            if (rand <= 0) return { name: pattern.name, pattern };
        }
        return { name: behaviorPatterns[0].name, pattern: behaviorPatterns[0] };
    }
    // ==============================================

    let lastPatternStayTime = null;
    console.log('[Price Tracker] 스크립트 시작!');

    // ========== Supabase 설정 ==========
    const SUPABASE_URL = 'https://rmbowbqxdryndsekobmh.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtYm93YnF4ZHJ5bmRzZWtvYm1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MjQ1NTAsImV4cCI6MjA4MzQwMDU1MH0.zbY__R1s7RLLSWEgmJfTYXSVz_G64sLIZEN1j5YpwKc';

    // ========== 인증 토큰 ==========
    let AUTH_TOKEN = GM_getValue('auth_token', null);
    // =============================================

    // base64url을 표준 base64로 변환 (JWT 디코딩용)
    function base64UrlDecode(str) {
        let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) base64 += '=';
        return atob(base64);
    }

    // JWT 토큰에서 만료 시간(Unix timestamp) 추출
    function getTokenExpiry(token) {
        if (!token || !token.access_token) return 0;
        try {
            const parts = token.access_token.split('.');
            if (parts.length !== 3) return 0;
            const payload = JSON.parse(base64UrlDecode(parts[1]));
            return payload.exp || 0;
        } catch (e) {
            return 0;
        }
    }

    // JWT 토큰 만료 확인 (5분 여유)
    function isTokenExpiredOrSoon() {
        if (!AUTH_TOKEN || !AUTH_TOKEN.access_token) return true;

        try {
            // JWT는 점으로 구분된 3부분: header.payload.signature
            const parts = AUTH_TOKEN.access_token.split('.');
            if (parts.length !== 3) return true;

            // payload를 base64url 안전 디코딩
            const payload = JSON.parse(base64UrlDecode(parts[1]));
            const exp = payload.exp; // 만료 시간 (Unix timestamp in seconds)
            const now = Math.floor(Date.now() / 1000); // 현재 시간 (seconds)

            // 5분(300초) 전에 미리 갱신
            const expiresIn = exp - now;
            console.log(`[Price Tracker] 토큰 만료까지: ${expiresIn}초 (${Math.floor(expiresIn / 60)}분)`);

            return expiresIn < 300; // 5분 미만이면 갱신 필요
        } catch (e) {
            console.log('[Price Tracker] 토큰 파싱 에러:', e);
            return true;
        }
    }


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
            console.log('[Price Tracker] 큐 체크 에러:', e);
        }
        return { hasQueue: false };
    }

    // 큐 설정 (YGIF에서 호출)
    function setUpdateQueue(urls) {
        GM_setValue('coupang_update_queue', urls);
        GM_setValue('coupang_update_index', 0);
        console.log('[Price Tracker] 큐 설정됨:', urls.length, '개');
    }

    // 뒤로 가기로 YGIF로 돌아가기 (저장 완료 후)
    function goBackToYGIF() {
        const stayTime = lastPatternStayTime || randomBetween(3000, 8000);
        lastPatternStayTime = null;
        console.log(`[Price Tracker] 데이터 저장 완료, ${(stayTime/1000).toFixed(1)}초 후 돌아갑니다...`);

        setTimeout(() => {
            // 브라우저 뒤로 가기
            window.history.back();
        }, stayTime);
    }

    // 가격 히스토리 저장 (하루에 한 번만) - 콜백 추가
    function savePriceHistory(productId, price, accessToken, callback) {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식

        console.log('[Price Tracker] 가격 히스토리 저장 시작...', { productId, price, today });

        // 오늘 날짜에 이미 기록이 있는지 확인
        GM_xmlhttpRequest({
            method: 'GET',
            url: `${SUPABASE_URL}/rest/v1/price_history?product_id=eq.${productId}&recorded_date=eq.${today}&select=id`,
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            onload: function (response) {
                console.log('[Price Tracker] 가격 히스토리 조회 응답:', response.status, response.responseText);

                let existing = [];
                try {
                    existing = JSON.parse(response.responseText);
                } catch (e) {
                    console.log('[Price Tracker] 가격 히스토리 조회 파싱 에러:', e);
                }

                if (existing && existing.length > 0) {
                    // 오늘 이미 기록됨 - 가격 업데이트
                    console.log('[Price Tracker] 오늘 가격 히스토리 이미 존재, 업데이트');
                    GM_xmlhttpRequest({
                        method: 'PATCH',
                        url: `${SUPABASE_URL}/rest/v1/price_history?id=eq.${existing[0].id}`,
                        headers: {
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=minimal'
                        },
                        data: JSON.stringify({
                            price: price
                        }),
                        onload: function (res) {
                            if (res.status >= 200 && res.status < 300) {
                                console.log('[Price Tracker] ✅ 가격 히스토리 업데이트됨');
                            } else {
                                console.log('[Price Tracker] ❌ 가격 히스토리 업데이트 실패:', res.responseText);
                            }
                            if (callback) callback();
                        },
                        onerror: function (err) {
                            console.log('[Price Tracker] 가격 히스토리 업데이트 네트워크 에러:', err);
                            if (callback) callback();
                        }
                    });
                } else {
                    // 새로운 가격 히스토리 추가
                    console.log('[Price Tracker] 새 가격 히스토리 저장 시도...');
                    GM_xmlhttpRequest({
                        method: 'POST',
                        url: `${SUPABASE_URL}/rest/v1/price_history`,
                        headers: {
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=minimal'
                        },
                        data: JSON.stringify({
                            product_id: productId,
                            price: price,
                            recorded_date: today
                        }),
                        onload: function (res) {
                            if (res.status >= 200 && res.status < 300) {
                                console.log('[Price Tracker] ✅ 가격 히스토리 저장됨');
                            } else {
                                console.log('[Price Tracker] ❌ 가격 히스토리 저장 실패:', res.status, res.responseText);
                            }
                            if (callback) callback();
                        },
                        onerror: function (err) {
                            console.log('[Price Tracker] 가격 히스토리 저장 네트워크 에러:', err);
                            if (callback) callback();
                        }
                    });
                }
            },
            onerror: function (err) {
                console.log('[Price Tracker] 가격 히스토리 확인 에러:', err);
                if (callback) callback();
            }
        });
    }

    // 업데이트 중단하고 YGIF로 돌아가기 (에러 발생 시)
    function stopUpdateAndGoBack(errorMessage) {
        console.log('[Price Tracker] 업데이트 중단:', errorMessage);

        // 업데이트 큐 정리
        GM_setValue('coupang_update_queue', null);
        GM_setValue('coupang_update_index', -1);

        showNotification('❌ 업데이트 중단', errorMessage + '\n\nYGIF로 돌아갑니다...', false);

        // 5초 후 YGIF로 이동
        const ygifUrl = GM_getValue('ygif_base_url', 'https://ygif-pied.vercel.app/coupang');
        setTimeout(() => {
            window.location.href = ygifUrl;
        }, 5000);
    }

    // YGIF로 이동하여 토큰 갱신 (유저스크립트에서 직접 refresh하지 않음 - race condition 방지)
    function goToYGIFForTokenRefresh() {
        // 무한 리다이렉트 루프 방지: 3회 초과 시 중단
        const retryCount = GM_getValue('token_refresh_retries', 0);
        if (retryCount >= 3) {
            GM_setValue('token_refresh_retries', 0);
            stopUpdateAndGoBack('토큰 갱신 3회 실패: YGIF에서 다시 로그인해주세요');
            return;
        }
        GM_setValue('token_refresh_retries', retryCount + 1);

        console.log(`[Price Tracker] 토큰 만료/무효 - YGIF로 이동하여 갱신 위임 (시도 ${retryCount + 1}/3)`);
        const ygifUrl = GM_getValue('ygif_base_url', 'https://ygif-pied.vercel.app/coupang');
        showNotification('🔄 토큰 갱신', `YGIF로 이동하여 토큰을 갱신합니다... (${retryCount + 1}/3)`);
        setTimeout(() => {
            const url = new URL(ygifUrl);
            url.searchParams.set('tokenRefresh', '1');
            window.location.href = url.toString();
        }, 1500);
    }


    // [v2.8] refreshAccessToken 제거됨
    // 토큰 갱신은 오직 YGIF의 Supabase JS(autoRefreshToken)만 담당
    // 유저스크립트에서 직접 /auth/v1/token을 호출하면 Refresh Token Rotation으로 인한 race condition 발생
    // 대신 goToYGIFForTokenRefresh()로 YGIF에 위임

    // 쿠팡 제품 페이지인지 확인
    function isCoupangProductPage() {
        return window.location.hostname.includes('coupang.com') && (
            window.location.href.includes('/vp/products/') ||
            window.location.href.includes('/products/')
        );
    }

    // 11번가 페이지인지 확인
    function is11stPage() {
        return window.location.hostname.includes('11st.co.kr');
    }

    function is11stProductPage() {
        return is11stPage() && (
            window.location.href.includes('/products/') ||
            window.location.href.includes('/product/')
        );
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
        // 방법1: aria-label에서 추출 (가장 정확)
        const ratingDiv = document.querySelector('.review-atf div[aria-label]');
        if (ratingDiv) {
            rating = parseFloat(ratingDiv.getAttribute('aria-label')) || null;
        }
        // 방법2: 별 개수로 추출
        if (!rating) {
            const stars = document.querySelectorAll('.review-atf svg');
            if (stars.length > 0) {
                rating = stars.length; // 채워진 별 개수
            }
        }
        console.log('[Price Tracker] 추출된 별점:', rating);

        // 리뷰 수 추출 (예: (538))
        let reviewCount = null;
        // 방법1: review-atf 내부의 괄호 안 숫자
        const reviewAtf = document.querySelector('.review-atf');
        if (reviewAtf) {
            const text = reviewAtf.textContent;
            const match = text.match(/\((\d+(?:,\d+)*)\)/);
            if (match) {
                reviewCount = parseInt(match[1].replace(/,/g, '')) || null;
            }
        }
        console.log('[Price Tracker] 추출된 리뷰수:', reviewCount);

        // 월간 구매수 추출 (예: "한 달간 100명 이상 구매했어요", "100+명이 구매했어요" 등)
        let monthlyPurchases = null;

        // 방법1: 모든 요소에서 "구매" 관련 텍스트 검색
        const allElements = document.querySelectorAll('p, span, div, strong, em');
        for (const el of allElements) {
            const text = el.textContent?.trim() || '';
            // "OOO명" 또는 "OOO+" 패턴 검색
            if (text.includes('구매') || text.includes('명이') || text.includes('한 달')) {
                // 패턴1: "100명", "1,000명"
                let match = text.match(/(\d+(?:,\d+)*)\s*명/);
                if (match) {
                    monthlyPurchases = parseInt(match[1].replace(/,/g, '')) || null;
                    if (monthlyPurchases) break;
                }
                // 패턴2: "100+" 형태
                match = text.match(/(\d+(?:,\d+)*)\+/);
                if (match) {
                    monthlyPurchases = parseInt(match[1].replace(/,/g, '')) || null;
                    if (monthlyPurchases) break;
                }
            }
        }

        // 방법2: 특정 클래스나 구조에서 검색 (쿠팡 구조 변경 대비)
        if (!monthlyPurchases) {
            const purchaseIndicators = document.querySelectorAll('[class*="purchase"], [class*="buyer"], [class*="sold"]');
            for (const el of purchaseIndicators) {
                const text = el.textContent?.trim() || '';
                const match = text.match(/(\d+(?:,\d+)*)/);
                if (match) {
                    const num = parseInt(match[1].replace(/,/g, ''));
                    if (num > 0 && num < 1000000) { // 합리적인 범위 체크
                        monthlyPurchases = num;
                        break;
                    }
                }
            }
        }

        console.log('[Price Tracker] 추출된 월간 구매수:', monthlyPurchases);

        return {
            url: window.location.href.split('?')[0],
            product_name: productName,
            current_price: currentPrice,
            original_price: originalPrice,
            discount_rate: discountRate,
            rating: rating,
            review_count: reviewCount,
            monthly_purchases: monthlyPurchases,
            platform: 'coupang'
        };
    }


    // 11번가 데이터 추출 (v3.1 - JS 번들 분석 기반 정확한 셀렉터)
    // 11번가는 React SPA로, DOM 구조:
    //   상품명: <div class="c_prd_name"><strong>{name}</strong></div>
    //   가격:   <div class="c_prd_price"><dl>...<dd class="price"><strong><span class="value">{price}</span></strong></dd></dl></div>
    //   원래가: <dd class="price_regular"><del>{price}</del>원</dd>
    //   할인율: <dd class="rate"><span class="value">{rate}</span>%</dd>
    //   별점:   <span class="c-starrate__gauge" style="width:{pct}%">만족도 {pct}%</span>
    //   리뷰:   <dd class="c-starrate__review"><span>{count}</span></dd>
    function extract11stProductData() {
        // 상품명
        const nameEl = document.querySelector('.c_prd_name strong') ||
            document.querySelector('.c_prd_name') ||
            document.querySelector('h1');
        const productName = nameEl ? nameEl.textContent.trim() : document.title.replace(/\[11번가\]\s*/, '').split(' - ')[0].trim();

        // 판매가 (최종 가격)
        let currentPrice = 0;
        const salePriceEl = document.querySelector('.c_prd_price .price .value') ||
            document.querySelector('.c_prd_price dd.price .value') ||
            document.querySelector('.b_product_info_price .price .value') ||
            document.querySelector('.c_product_price_basic .price .value');
        if (salePriceEl) {
            currentPrice = parseInt(salePriceEl.textContent.replace(/[^0-9]/g, '')) || 0;
        }
        // 폴백: c_prd_price 안의 가격 .value만 검색 (할인율 .rate 제외)
        if (currentPrice === 0) {
            const valueEls = document.querySelectorAll('.c_prd_price .value');
            for (const el of valueEls) {
                if (el.closest('.rate') || el.closest('.price_regular')) continue;
                const p = parseInt(el.textContent.replace(/[^0-9]/g, ''));
                if (p > 100) {
                    currentPrice = p;
                    break;
                }
            }
        }

        // 원래가 (정가, 취소선 가격)
        let originalPrice = currentPrice;
        const origEl = document.querySelector('.c_prd_price .price_regular del') ||
            document.querySelector('.c_prd_price .price_regular') ||
            document.querySelector('.b_product_info_price .price_regular del');
        if (origEl) {
            const p = parseInt(origEl.textContent.replace(/[^0-9]/g, ''));
            if (p > originalPrice) originalPrice = p;
        }

        // 할인율
        let discountRate = '0%';
        const rateEl = document.querySelector('.c_prd_price .rate .value') ||
            document.querySelector('.c_prd_price dd.rate .value');
        if (rateEl) {
            const rate = parseInt(rateEl.textContent.replace(/[^0-9]/g, ''));
            if (rate > 0) discountRate = rate + '%';
        } else if (originalPrice > currentPrice && currentPrice > 0) {
            discountRate = Math.round((1 - currentPrice / originalPrice) * 100) + '%';
        }

        // 별점 (c-starrate__gauge의 width% → 5점 만점 변환)
        let rating = null;
        const gaugeEl = document.querySelector('.c-starrate__gauge');
        if (gaugeEl) {
            // style.width에서 추출 (width: 85% → 4.3점)
            const widthMatch = gaugeEl.style.width?.match(/(\d+)/);
            if (widthMatch) {
                rating = parseFloat((parseInt(widthMatch[1]) / 20).toFixed(1));
            }
            // 텍스트에서 추출 ("만족도 : 85%")
            if (!rating) {
                const textMatch = gaugeEl.textContent.match(/(\d+)/);
                if (textMatch) {
                    rating = parseFloat((parseInt(textMatch[1]) / 20).toFixed(1));
                }
            }
        }

        // 리뷰 수
        let reviewCount = null;
        const reviewEl = document.querySelector('.c-starrate__review');
        if (reviewEl) {
            const match = reviewEl.textContent.match(/(\d+(?:,\d+)*)/);
            if (match) reviewCount = parseInt(match[1].replace(/,/g, '')) || null;
        }

        // 월간 구매수 (11번가에서 "N개 구매" 형태) - 리프 노드만 검색하여 오탐 방지
        let monthlyPurchases = null;
        const buyQtyEls = document.querySelectorAll('.b_product_info_cont span, .b_product_info_cont em, .b_product_info_cont strong, .c_prd_price span, .c_prd_price em');
        for (const el of buyQtyEls) {
            const text = el.textContent?.trim() || '';
            if ((text.includes('구매') || text.includes('판매')) && text.length < 50 && el.children.length === 0) {
                const match = text.match(/(\d+(?:,\d+)*)/);
                if (match) {
                    const num = parseInt(match[1].replace(/,/g, ''));
                    if (num > 0 && num < 1000000) {
                        monthlyPurchases = num;
                        break;
                    }
                }
            }
        }

        console.log('[Price Tracker] 11번가 추출 결과:', {
            productName, currentPrice, originalPrice, discountRate, rating, reviewCount, monthlyPurchases
        });

        return {
            url: window.location.href.split('?')[0],
            product_name: productName,
            current_price: currentPrice,
            original_price: originalPrice,
            discount_rate: discountRate,
            rating: rating,
            review_count: reviewCount,
            monthly_purchases: monthlyPurchases,
            platform: '11st'
        };
    }

    // HTML 이스케이프 (XSS 방지)
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
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
            <div style="font-weight: bold; margin-bottom: 4px;">${escapeHtml(title)}</div>
            <div style="font-size: 12px; opacity: 0.9; white-space: pre-line;">${escapeHtml(text + queueInfo)}</div>
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
                // 401 에러 시 YGIF로 이동하여 토큰 갱신 (직접 refresh하지 않음)
                if (response.status === 401) {
                    console.log('[Price Tracker] 401 에러, YGIF로 이동하여 토큰 갱신');
                    goToYGIFForTokenRefresh();
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
                            last_updated: new Date().toISOString(),
                            platform: productData.platform || 'coupang'
                        }),
                        onload: function (res) {
                            if (res.status >= 200 && res.status < 300) {
                                const changeText = priceChange === '0%' ? '변동 없음' : `전일대비 ${priceChange}`;
                                showNotification(
                                    '✅ 가격 업데이트됨',
                                    `${productData.product_name.substring(0, 25)}...\n💰 ${productData.current_price.toLocaleString()}원\n📊 ${changeText}`
                                );
                                GM_setValue('token_refresh_retries', 0); // 성공 시 리다이렉트 카운터 리셋
                                // 가격 히스토리 저장 후 뒤로 가기
                                savePriceHistory(existingProduct.id, productData.current_price, accessToken, goBackToYGIF);
                            } else {
                                // 실패 시 업데이트 중단하고 YGIF로
                                stopUpdateAndGoBack('업데이트 실패: ' + res.responseText.substring(0, 80));
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
                            'Prefer': 'return=representation' // 새로 생성된 제품 ID를 받기 위해 변경
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
                            last_updated: new Date().toISOString(),
                            platform: productData.platform || 'coupang'
                        }),
                        onload: function (res) {
                            if (res.status >= 200 && res.status < 300) {
                                showNotification(
                                    '✅ 제품 추가됨',
                                    `${productData.product_name.substring(0, 25)}...\n💰 ${productData.current_price.toLocaleString()}원`
                                );
                                GM_setValue('token_refresh_retries', 0); // 성공 시 리다이렉트 카운터 리셋
                                // 새로 생성된 제품의 ID로 가격 히스토리 저장 후 뒤로 가기
                                try {
                                    const newProduct = JSON.parse(res.responseText);
                                    if (newProduct && newProduct.length > 0 && newProduct[0].id) {
                                        savePriceHistory(newProduct[0].id, productData.current_price, accessToken, goBackToYGIF);
                                    } else {
                                        goBackToYGIF();
                                    }
                                } catch (e) {
                                    console.log('[Price Tracker] 새 제품 ID 파싱 에러:', e);
                                    goBackToYGIF();
                                }
                            } else {
                                // 실패 시 업데이트 중단하고 YGIF로
                                stopUpdateAndGoBack('추가 실패: ' + res.responseText.substring(0, 80));
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
            window.location.href.includes('127.0.0.1:3000') ||
            window.location.href.includes('ygif-pied.vercel.app');
    }

    // YGIF에서 순차 업데이트 시작 버튼 추가
    function setupYGIFIntegration() {
        console.log('[Price Tracker] YGIF 페이지 감지, 통합 설정 중...');

        // YGIF 기본 URL 저장 (쿠팡에서 토큰 갱신 시 돌아올 URL)
        GM_setValue('ygif_base_url', window.location.origin + '/coupang');

        // YGIF localStorage에서 Supabase 토큰 동기화 (즉시 + 지연)
        syncTokenFromLocalStorage();
        // Supabase JS가 세션 복구 후 재동기화 (React hydration 대기)
        setTimeout(syncTokenFromLocalStorage, 1000);
        setTimeout(syncTokenFromLocalStorage, 3000);
        setTimeout(syncTokenFromLocalStorage, 5000);
        // 주기적 동기화 (30초마다 - 토큰 rotation 대응)
        setInterval(syncTokenFromLocalStorage, 30000);

        // YGIF 앱의 TOKEN_REFRESHED 이벤트 감지 → 즉시 GM 동기화
        document.addEventListener('ygifTokenRefreshed', function () {
            console.log('[Price Tracker] TOKEN_REFRESHED 이벤트 감지, 즉시 GM 동기화');
            syncTokenFromLocalStorage();
        });

        // localStorage 변경 감지 (다른 탭에서 토큰 갱신 시)
        window.addEventListener('storage', function (e) {
            if (e.key && ((e.key.includes('sb-') && e.key.includes('auth-token')) || e.key === 'ygif_token_refreshed_at')) {
                console.log('[Price Tracker] localStorage 토큰 변경 감지:', e.key);
                syncTokenFromLocalStorage();
            }
        });

        // CustomEvent 리스너 (YGIF에서 이벤트 발생 시 처리)
        document.addEventListener('startCoupangUpdate', function (e) {
            // 업데이트 시작 전 토큰 다시 동기화
            syncTokenFromLocalStorage();

            const urls = e.detail.urls;
            if (!urls || urls.length === 0) {
                alert('업데이트할 제품이 없습니다.');
                return;
            }

            GM_setValue('coupang_update_queue', urls);
            GM_setValue('coupang_update_index', 0);

            console.log('[Price Tracker] 큐 설정됨:', urls.length, '개');
            console.log('[Price Tracker] 첫 번째 제품으로 이동:', urls[0]);

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

        console.log('[Price Tracker] YGIF 통합 완료 - CustomEvent "startCoupangUpdate" 대기 중');
    }

    // YGIF localStorage ↔ GM_setValue 양방향 토큰 동기화
    function syncTokenFromLocalStorage() {
        try {
            // 진단: localStorage에서 Supabase 관련 키 모두 검색
            const allKeys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.includes('sb-')) allKeys.push(key);
            }
            console.log('[Price Tracker] localStorage sb- 키 목록:', allKeys);

            const supabaseKey = 'sb-rmbowbqxdryndsekobmh-auth-token';
            const tokenStr = localStorage.getItem(supabaseKey);
            const gmToken = GM_getValue('auth_token', null);
            const now = Math.floor(Date.now() / 1000);

            console.log('[Price Tracker] 진단 - localStorage 토큰 존재:', !!tokenStr,
                '| GM 토큰 존재:', !!gmToken);

            if (tokenStr) {
                const tokenData = JSON.parse(tokenStr);
                console.log('[Price Tracker] 진단 - tokenData 키:', Object.keys(tokenData || {}));

                if (tokenData && tokenData.access_token && tokenData.refresh_token) {
                    const lsExpiry = getTokenExpiry(tokenData);
                    const gmExpiry = getTokenExpiry(gmToken);

                    if (gmToken && gmExpiry > lsExpiry) {
                        // GM 토큰이 더 최신 (쿠팡에서 갱신됨) → GM 사용 + localStorage 역동기화
                        AUTH_TOKEN = gmToken;
                        tokenData.access_token = gmToken.access_token;
                        tokenData.refresh_token = gmToken.refresh_token;
                        tokenData.expires_at = gmExpiry;
                        localStorage.setItem(supabaseKey, JSON.stringify(tokenData));
                        console.log('[Price Tracker] ✅ GM 토큰이 더 최신 → localStorage 역동기화 완료!');
                        console.log('[Price Tracker] 토큰 만료까지:', Math.floor((gmExpiry - now) / 60), '분');
                    } else {
                        // localStorage 토큰이 더 최신 → GM으로 동기화
                        AUTH_TOKEN = {
                            access_token: tokenData.access_token,
                            refresh_token: tokenData.refresh_token,
                            user: tokenData.user
                        };
                        GM_setValue('auth_token', AUTH_TOKEN);
                        console.log('[Price Tracker] ✅ localStorage → GM 토큰 동기화 완료!');
                        console.log('[Price Tracker] 토큰 만료까지:', Math.floor((lsExpiry - now) / 60), '분');
                    }
                }
            } else if (gmToken) {
                // localStorage 없지만 GM에 토큰 있음 → GM 사용
                AUTH_TOKEN = gmToken;
                console.log('[Price Tracker] localStorage 없음, GM 토큰 사용');
            } else {
                console.log('[Price Tracker] ⚠️ 토큰 없음 (localStorage, GM 모두)');
            }
        } catch (e) {
            console.log('[Price Tracker] 토큰 동기화 에러:', e);
        }
    }

    // 제품 페이지 처리 (쿠팡 + 11번가 공통)
    async function handleProductPage() {
        const is11st = is11stPage();
        console.log(`[Price Tracker] ${is11st ? '11번가' : '쿠팡'} 제품 페이지 감지!`);

        // 쿠팡에서만 인간 행동 시뮬레이션 (11번가는 불필요)
        if (!is11st) {
            try {
                const { name, pattern } = selectBehaviorPattern();
                console.log(`[Price Tracker] 행동 패턴: ${name}`);
                await pattern.execute();
                lastPatternStayTime = pattern.stayTime();
            } catch (e) {
                console.log('[Price Tracker] 시뮬레이션 에러 (무시):', e);
            }
        }

        const productData = is11st ? extract11stProductData() : extractProductData();
        console.log('[Price Tracker] 추출 데이터:', productData);

        if (productData.current_price > 0) {
            if (!AUTH_TOKEN) {
                console.log('[Price Tracker] ⚠️ 토큰 없음 - YGIF에서 로그인 필요');
                stopUpdateAndGoBack('토큰 없음: YGIF 쿠팡 페이지에서 먼저 로그인해주세요');
                return;
            }
            if (isTokenExpiredOrSoon()) {
                console.log('[Price Tracker] 토큰 만료됨/곧 만료, YGIF로 이동하여 갱신');
                goToYGIFForTokenRefresh();
            } else {
                saveToSupabase(productData);
            }
        } else {
            showNotification('⚠️ 가격 없음', '가격 정보를 찾을 수 없습니다.\n5초 후 뒤로 돌아갑니다...', false);
            setTimeout(() => {
                window.history.back();
            }, 5000);
        }
    }

    // 메인
    function main() {
        if (isYGIFPage()) {
            setupYGIFIntegration();
            return;
        }

        if (isCoupangProductPage() || is11stProductPage()) {
            handleProductPage();
            return;
        }

        console.log('[Price Tracker] 제품 페이지가 아님');
    }

    // 11번가 SPA 렌더링 대기 (React가 DOM을 그릴 때까지 폴링, 최대 15초)
    function waitFor11stRender(callback) {
        const maxWait = 15000;
        const startTime = Date.now();
        const checkInterval = setInterval(() => {
            const priceEl = document.querySelector('.c_prd_price .value') ||
                document.querySelector('.c_prd_price .price .value') ||
                document.querySelector('.c_prd_name');
            if (priceEl || (Date.now() - startTime > maxWait)) {
                clearInterval(checkInterval);
                if (priceEl) {
                    console.log('[Price Tracker] 11번가 SPA 렌더링 완료 감지!');
                } else {
                    console.log('[Price Tracker] 11번가 SPA 렌더링 대기 타임아웃 (15초)');
                }
                // 렌더링 직후 약간의 안정화 대기
                setTimeout(callback, 500);
            }
        }, 500);
    }

    // YGIF 페이지는 즉시 실행, 11번가는 SPA 렌더링 대기 후, 쿠팡은 랜덤 대기
    if (isYGIFPage()) {
        main();
    } else if (is11stPage()) {
        waitFor11stRender(main);
    } else {
        setTimeout(main, randomBetween(3000, 5000));
    }
})();
