// Background Service Worker - 메시지 라우팅 및 탭 관리
console.log('[Coupang Tracker] Background service worker started');

// 수집된 데이터 저장소
let collectedData = [];
let pendingUrls = [];
let isProcessing = false;
let ygifTabId = null;

// 메시지 리스너
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Coupang Tracker] Message received:', request.action);

    switch (request.action) {
        case 'startScraping':
            // YGIF 페이지에서 스크래핑 시작 요청
            ygifTabId = sender.tab?.id;
            pendingUrls = request.urls || [];
            collectedData = [];
            console.log('[Coupang Tracker] Starting scraping for', pendingUrls.length, 'URLs');
            processNextUrl();
            sendResponse({ success: true, message: 'Scraping started' });
            break;

        case 'dataExtracted':
            // Content script에서 데이터 추출 완료
            if (request.data) {
                collectedData.push(request.data);
                console.log('[Coupang Tracker] Data collected:', request.data.productName);

                // 탭 닫기
                if (sender.tab?.id) {
                    setTimeout(() => {
                        chrome.tabs.remove(sender.tab.id).catch(() => { });
                    }, 1000);
                }

                // 다음 URL 처리
                setTimeout(() => processNextUrl(), 3000 + Math.random() * 2000);
            }
            break;

        case 'accessDenied':
            // Access Denied 발생
            console.log('[Coupang Tracker] Access Denied for:', request.url);
            collectedData.push({
                url: request.url,
                productName: '',
                currentPrice: 0,
                originalPrice: 0,
                discountRate: '0%',
                error: 'Access Denied'
            });

            if (sender.tab?.id) {
                setTimeout(() => {
                    chrome.tabs.remove(sender.tab.id).catch(() => { });
                }, 500);
            }

            setTimeout(() => processNextUrl(), 5000);
            break;

        case 'getStatus':
            // 상태 조회
            sendResponse({
                isProcessing,
                pending: pendingUrls.length,
                collected: collectedData.length
            });
            break;

        case 'getResults':
            // 결과 조회
            sendResponse({
                success: true,
                results: collectedData
            });
            break;
    }

    return true;
});

// 다음 URL 처리
async function processNextUrl() {
    if (pendingUrls.length === 0) {
        // 모든 URL 처리 완료
        isProcessing = false;
        console.log('[Coupang Tracker] All URLs processed. Total:', collectedData.length);

        // YGIF 페이지에 결과 전송
        if (ygifTabId) {
            try {
                await chrome.tabs.sendMessage(ygifTabId, {
                    action: 'scrapingComplete',
                    results: collectedData
                });
            } catch (e) {
                console.log('[Coupang Tracker] Could not send to YGIF tab:', e);
            }
        }
        return;
    }

    isProcessing = true;
    const url = pendingUrls.shift();
    console.log('[Coupang Tracker] Opening:', url);
    console.log('[Coupang Tracker] Remaining:', pendingUrls.length);

    try {
        // 새 탭에서 URL 열기
        await chrome.tabs.create({
            url: url,
            active: false // 백그라운드에서 열기
        });
    } catch (error) {
        console.error('[Coupang Tracker] Error opening tab:', error);
        collectedData.push({
            url: url,
            productName: '',
            currentPrice: 0,
            originalPrice: 0,
            discountRate: '0%',
            error: error.message
        });
        setTimeout(() => processNextUrl(), 1000);
    }
}
