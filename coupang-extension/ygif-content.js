// YGIF Content Script - localhost:3000/coupang 페이지에서 실행
(function () {
    'use strict';

    // YGIF 페이지인지 확인
    if (!window.location.href.includes('localhost:3000/coupang')) {
        return;
    }

    console.log('[Coupang Tracker] YGIF Content script loaded');

    // 확장 프로그램에서 스크래핑 완료 메시지 수신
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'scrapingComplete') {
            console.log('[Coupang Tracker] Scraping complete, received results:', request.results);

            // 결과를 YGIF 페이지에 전달 (커스텀 이벤트 사용)
            window.dispatchEvent(new CustomEvent('coupangScrapingComplete', {
                detail: { results: request.results }
            }));

            sendResponse({ success: true });
        }
        return true;
    });

    // "전체 업데이트" 버튼에 클릭 이벤트 연결
    function attachToUpdateButton() {
        // 버튼 찾기 (여러 방법 시도)
        const updateBtns = document.querySelectorAll('button');

        for (const btn of updateBtns) {
            if (btn.textContent.includes('전체 업데이트') && !btn.dataset.coupangTrackerAttached) {
                btn.dataset.coupangTrackerAttached = 'true';

                // 기존 클릭 핸들러를 덮어쓰기
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    console.log('[Coupang Tracker] Update button clicked');

                    // localStorage에서 제품 URL 가져오기
                    const stored = localStorage.getItem('coupang_tracker_data');
                    if (!stored) {
                        alert('저장된 제품이 없습니다.');
                        return;
                    }

                    try {
                        const data = JSON.parse(stored);
                        const urls = data.products.map(p => p.url);

                        if (urls.length === 0) {
                            alert('업데이트할 제품이 없습니다.');
                            return;
                        }

                        if (!confirm(`${urls.length}개 제품의 가격을 업데이트하시겠습니까?`)) {
                            return;
                        }

                        // 확장 프로그램에 스크래핑 시작 요청
                        chrome.runtime.sendMessage({
                            action: 'startScraping',
                            urls: urls
                        }, (response) => {
                            if (chrome.runtime.lastError) {
                                alert('확장 프로그램이 설치되어 있지 않거나 활성화되지 않았습니다.\n\nChrome 확장 프로그램을 설치해주세요.');
                                return;
                            }

                            if (response && response.success) {
                                alert('스크래핑이 시작되었습니다!\n백그라운드에서 처리됩니다.');
                            }
                        });
                    } catch (error) {
                        console.error('[Coupang Tracker] Error:', error);
                        alert('오류가 발생했습니다: ' + error.message);
                    }
                }, true); // capture phase에서 실행

                console.log('[Coupang Tracker] Attached to update button');
            }
        }
    }

    // 스크래핑 결과 처리
    window.addEventListener('coupangScrapingComplete', (e) => {
        const results = e.detail.results;
        console.log('[Coupang Tracker] Processing results:', results);

        // localStorage에서 기존 데이터 로드
        const stored = localStorage.getItem('coupang_tracker_data');
        if (!stored) return;

        try {
            const data = JSON.parse(stored);

            // 결과로 제품 데이터 업데이트
            data.products = data.products.map(product => {
                const result = results.find(r => r.url === product.url);
                if (result && result.currentPrice > 0) {
                    const priceChange = product.currentPrice > 0
                        ? ((result.currentPrice - product.currentPrice) / product.currentPrice * 100).toFixed(1) + '%'
                        : '0%';

                    return {
                        ...product,
                        previousPrice: product.currentPrice,
                        currentPrice: result.currentPrice,
                        originalPrice: result.originalPrice,
                        discountRate: result.discountRate,
                        priceChangeRate: priceChange,
                        lastUpdated: new Date().toISOString()
                    };
                }
                return product;
            });

            // 저장
            localStorage.setItem('coupang_tracker_data', JSON.stringify(data));

            // 페이지 새로고침
            const successCount = results.filter(r => r.currentPrice > 0).length;
            const failCount = results.filter(r => !r.currentPrice).length;

            alert(`업데이트 완료!\n성공: ${successCount}개\n실패: ${failCount}개\n\n페이지를 새로고침합니다.`);
            window.location.reload();

        } catch (error) {
            console.error('[Coupang Tracker] Error updating data:', error);
            alert('데이터 업데이트 중 오류가 발생했습니다.');
        }
    });

    // 페이지 로드 시 버튼 연결
    setTimeout(attachToUpdateButton, 1000);

    // DOM 변경 감지 (동적으로 버튼이 추가될 경우)
    const observer = new MutationObserver(() => {
        attachToUpdateButton();
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
