// Popup Script
document.addEventListener('DOMContentLoaded', () => {
    const statusEl = document.getElementById('status');
    const collectedEl = document.getElementById('collected');
    const pendingEl = document.getElementById('pending');
    const checkBtn = document.getElementById('checkBtn');
    const statusBtn = document.getElementById('statusBtn');

    // 상태 업데이트
    async function updateStatus() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
            if (response) {
                statusEl.textContent = response.isProcessing ? '처리 중...' : '대기 중';
                statusEl.className = 'status-value' + (response.isProcessing ? ' processing' : '');
                collectedEl.textContent = response.collected || 0;
                pendingEl.textContent = response.pending || 0;
            }
        } catch (e) {
            console.log('Status error:', e);
        }
    }

    // 현재 페이지 스크래핑
    checkBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab.url.includes('coupang.com/vp/products')) {
            alert('쿠팡 제품 페이지에서 실행해주세요!');
            return;
        }

        try {
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractData' });
            if (response && response.success) {
                alert(`데이터 추출 성공!\n\n제품명: ${response.data.productName}\n가격: ${response.data.currentPrice.toLocaleString()}원`);
            } else {
                alert('데이터 추출에 실패했습니다.');
            }
        } catch (e) {
            alert('Content script가 로드되지 않았습니다. 페이지를 새로고침해주세요.');
        }
    });

    // 상태 새로고침
    statusBtn.addEventListener('click', updateStatus);

    // 초기 상태 로드
    updateStatus();
});
