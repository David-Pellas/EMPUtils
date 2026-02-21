(function () {
    const AD_KEYS = ['adPlacements', 'adSlots', 'playerAds', 'adBreakHeartbeatParams'];

    function stripAds(obj) {
        if (!obj || typeof obj !== 'object') return obj;
        for (const key of AD_KEYS) delete obj[key];
        return obj;
    }

    let _initial;
    Object.defineProperty(window, 'ytInitialPlayerResponse', {
        get() { return _initial; },
        set(v) { _initial = stripAds(v); },
        configurable: true,
    });

    const _fetch = window.fetch;
    window.fetch = async function (input, init) {
        const url = typeof input === 'string' ? input : (input?.url ?? '');
        const res = await _fetch.apply(this, arguments);
        if (!url.includes('/youtubei/v1/player')) return res;
        try {
            const json = await res.clone().json();
            stripAds(json);
            return new Response(JSON.stringify(json), {
                status: res.status,
                statusText: res.statusText,
                headers: { 'content-type': 'application/json; charset=utf-8' },
            });
        } catch {
            return res; // parse failed
        }
    };

    const OVERLAY_SELECTORS = [
        '.ytp-ad-overlay-container',
        '.ytp-ad-image-overlay',
        '.ytp-ad-overlay-slot',
        '.ytp-ad-action-interstitial',        
        '.ytp-ad-action-interstitial-background-container',
    ];
    const SKIP_SELECTORS = [
        '.ytp-skip-ad-button',
        '.ytp-ad-skip-button',
        '.ytp-ad-skip-button-slot .ytp-button',
        '.ytp-ad-skip-button-modern',    
        '.ytp-ad-action-interstitial-skip-button', 
        '.ytp-ad-action-interstitial-slot .ytp-button', 
    ];

    function dismissAdOverlays() {
        for (const sel of SKIP_SELECTORS) {
            const btn = document.querySelector(sel);
            if (btn) { btn.click(); return; }
        }
        for (const sel of OVERLAY_SELECTORS) {
            const el = document.querySelector(sel);
            if (el) el.remove();
        }
    }

    const observer = new MutationObserver(dismissAdOverlays);
    observer.observe(document.documentElement, { childList: true, subtree: true });

    function forceSkipAdState() {
        const player = document.getElementById('movie_player');
        if (!player || !player.classList.contains('ad-showing')) return;

        // Prefer the skip button if present
        for (const sel of SKIP_SELECTORS) {
            const btn = document.querySelector(sel);
            if (btn) { btn.click(); return; }
        }

        const video = document.querySelector('video');
        if (!video) return;

        if (isFinite(video.duration) && video.duration > 0) {

            video.currentTime = video.duration;
        } else {
            // Duration unknown
            const wasMuted = video.muted;
            const wasRate  = video.playbackRate;
            video.muted = true;
            video.playbackRate = 16;

            const poll = setInterval(() => {
                if (!player.classList.contains('ad-showing')) {
                    video.muted = wasMuted;
                    video.playbackRate = wasRate;
                    clearInterval(poll);
                } else if (isFinite(video.duration) && video.duration > 0) {
                    video.currentTime = video.duration;
                }
            }, 150);
            setTimeout(() => {
                clearInterval(poll);
                video.muted = wasMuted;
                video.playbackRate = wasRate;
            }, 3000);
        }
    }

    let playerClassObserver = null;

    function attachPlayerObserver() {
        const player = document.getElementById('movie_player');
        if (!player) return;
        if (playerClassObserver) playerClassObserver.disconnect();
        playerClassObserver = new MutationObserver(forceSkipAdState);
        playerClassObserver.observe(player, { attributes: true, attributeFilter: ['class'] });
        forceSkipAdState(); 
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachPlayerObserver);
    } else {
        attachPlayerObserver();
    }

    document.addEventListener('yt-navigate-finish', attachPlayerObserver);
    document.addEventListener('yt-page-data-updated', attachPlayerObserver);
})();
