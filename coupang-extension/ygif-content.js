// YGIF Content Script - localhost:3000 페이지에서 Supabase 토큰 동기화
(function () {
    'use strict';

    if (!window.location.href.includes('localhost:3000') &&
        !window.location.href.includes('127.0.0.1:3000')) {
        return;
    }

    console.log('[Coupang Tracker] YGIF content script loaded');

    // Supabase localStorage에서 토큰을 chrome.storage.local로 동기화
    function syncToken() {
        try {
            const supabaseKey = 'sb-rmbowbqxdryndsekobmh-auth-token';
            const tokenStr = localStorage.getItem(supabaseKey);

            if (tokenStr) {
                const tokenData = JSON.parse(tokenStr);
                if (tokenData && tokenData.access_token && tokenData.refresh_token) {
                    const authToken = {
                        access_token: tokenData.access_token,
                        refresh_token: tokenData.refresh_token,
                        user: tokenData.user
                    };
                    chrome.storage.local.set({ auth_token: authToken });
                    console.log('[Coupang Tracker] Token synced to chrome.storage.local');

                    const expiresIn = tokenData.expires_at - Math.floor(Date.now() / 1000);
                    console.log('[Coupang Tracker] Token expires in:', Math.floor(expiresIn / 60), 'min');
                }
            } else {
                console.log('[Coupang Tracker] No Supabase token in localStorage');
            }
        } catch (e) {
            console.log('[Coupang Tracker] Token sync error:', e);
        }
    }

    // 즉시 동기화 + 주기적 동기화
    syncToken();
    setInterval(syncToken, 60000);

    // 준비 완료 신호
    document.dispatchEvent(new CustomEvent('coupangTrackerReady'));
    console.log('[Coupang Tracker] YGIF integration ready');
})();
