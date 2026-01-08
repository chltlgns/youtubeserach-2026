// Content Script - 쿠팡 제품 페이지에서 데이터 추출
(function () {
    'use strict';

    // 페이지가 쿠팡 제품 페이지인지 확인
    if (!window.location.href.includes('coupang.com/vp/products')) {
        return;
    }

    console.log('[Coupang Tracker] Content script loaded');

    // 데이터 추출 함수
    function extractProductData() {
        try {
            // 제품명
            const nameEl = document.querySelector('h1.product-title span.twc-font-bold, h1.product-title, .prod-buy-header__title');
            const productName = nameEl ? nameEl.textContent.trim() : document.title.split(' - ')[0];

            // 현재가격 (할인가)
            const priceEl = document.querySelector('.final-price-amount, .price-amount.final-price-amount, .prod-sale-price strong');
            let currentPrice = 0;
            if (priceEl) {
                currentPrice = parseInt(priceEl.textContent.replace(/[^0-9]/g, '')) || 0;
            }

            // Fallback: 가격 요소 찾기
            if (currentPrice === 0) {
                const allPriceElements = document.querySelectorAll('[class*="price"]');
                for (const el of allPriceElements) {
                    const text = el.textContent || '';
                    const match = text.match(/[\d,]+원/);
                    if (match) {
                        currentPrice = parseInt(match[0].replace(/[^0-9]/g, '')) || 0;
                        break;
                    }
                }
            }

            // 원래가격 (정가)
            const allPrices = document.querySelectorAll('.price-amount');
            let originalPrice = currentPrice;
            allPrices.forEach((el) => {
                const t = el.textContent.replace(/[^0-9]/g, '') || '0';
                const p = parseInt(t);
                if (p > originalPrice) originalPrice = p;
            });

            // 할인율 계산
            let discountRate = '0%';
            if (originalPrice > currentPrice && currentPrice > 0) {
                discountRate = Math.round((1 - currentPrice / originalPrice) * 100) + '%';
            }

            return {
                url: window.location.href,
                productName,
                currentPrice,
                originalPrice,
                discountRate,
                extractedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('[Coupang Tracker] Error extracting data:', error);
            return null;
        }
    }

    // 메시지 리스너 - Background에서 데이터 요청 시 응답
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'extractData') {
            console.log('[Coupang Tracker] Extracting data on request');
            const data = extractProductData();
            sendResponse({ success: !!data, data });
        }
        return true; // 비동기 응답을 위해 true 반환
    });

    // 페이지 로드 시 자동으로 데이터 추출하여 Background로 전송
    function autoExtractAndSend() {
        // 페이지 로딩 대기
        setTimeout(() => {
            const data = extractProductData();
            if (data && data.currentPrice > 0) {
                console.log('[Coupang Tracker] Auto-extracted:', data);
                chrome.runtime.sendMessage({
                    action: 'dataExtracted',
                    data: data
                });
            }
        }, 2000);
    }

    // Access Denied 체크
    if (document.title.includes('Access Denied')) {
        console.log('[Coupang Tracker] Access Denied detected');
        chrome.runtime.sendMessage({
            action: 'accessDenied',
            url: window.location.href
        });
    } else {
        autoExtractAndSend();
    }
})();
