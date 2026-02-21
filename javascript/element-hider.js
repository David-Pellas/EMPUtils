
(async function() {
    const currentDomain = window.location.hostname;
    const isYouTube = currentDomain.includes("youtube.com");
    const isRoblox  = currentDomain.includes("roblox.com");

    const data = await chrome.storage.local.get(['allowedPopups', 'blocklist_hide_css']);
    const allowedPopups = data.allowedPopups || [];
    const easyListHideCSS = data.blocklist_hide_css || '';

    if (allowedPopups.includes(currentDomain)) {
        console.log("[EMPUtils] Domain is whitelisted. Extension is in GHOST MODE.");
        return;
    }

    const AD_SELECTORS = [
        '[class*="ad-"]', '[class*="-ad-"]', '[class*="_ad_"]', '[class*="ad_"]',
        '[class*="ads-"]', '[class*="-ads"]', '[id*="ad-"]', '[id*="-ad"]',
        '[id*="_ad_"]', '[id*="ads-"]', '[id*="-ads"]', '[class*="banner"]',
        '[id*="banner"]', '[class*="Banner"]', '[class*="sponsor"]', '[class*="promo"]',
        '[id*="sponsor"]', '[id*="promo"]', '[class*="popup"]', '[class*="pop-up"]',
        '[id*="popup"]', '[class*="google-ad"]', '[class*="doubleclick"]',
        '[id*="google_ads"]', '[id*="dfp-ad"]', '[class*="ad_block"]',
        '[class*="adblock"]', '[class*="advertisement"]', '.ad', '.ads',
        '.advert', '.advertising', '#ad', '#ads', '.sponsored', '.sponsorship',
        'img[src*="/ads/"]', 'img[src*="/ad/"]', 'img[src*="banner"]',
        'img[src*="sponsor"]', 'img[src*="/promo/"]', 'iframe[src*="ads"]',
        'iframe[src*="ad."]', 'iframe[src*="doubleclick"]',
        'iframe[src*="googlesyndication"]', 'div[data-ad-slot]',
        'div[data-google-query-id]', 'ins.adsbygoogle', 'cnx',
        'cnx-lit-ui-template', '[class*="cnx-video"]', '[id*="connatix"]',
        'iframe[src*="analyticsTrackingId"]',
        'iframe[src*="analyticsOutcomeId"]',
        'iframe[src*="zephr"]', '[class*="zephrIframe"]',
        // Flash
        'object[type="application/x-shockwave-flash"]',
        'embed[type="application/x-shockwave-flash"]',
        'object[data$=".swf"]', 'embed[src$=".swf"]',
        '[classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000"]'
    ].join(',');
    const YT_AD_SELECTORS = [
        '.ytp-ad-player-overlay-instream-info',
        '.ytp-ad-player-overlay-layout',
        '.ytp-ad-visit-advertiser-button',
        '.ytp-ad-preview-container',
        '.ytp-ad-preview-text-container',
        '.ytp-ad-text',
        '.ytp-ad-progress-list',
        '.ytp-ad-action-interstitial',
        '.ytp-ad-image-overlay',
        '.ytp-paid-content-overlay',
        '.ytp-ce-element',
        '#player-ads',
        '.video-ads.ytp-show-tiles',
        'ytd-banner-promo-renderer',
        'ytd-statement-banner-renderer',
        'ytd-ad-slot-renderer',
        '.ytd-ad-slot-renderer',
        '#masthead-ad',
        'ytd-promoted-sparkles-web-renderer',
        'ytd-promoted-video-renderer',
        'ytd-rich-item-renderer:has(.ytd-ad-slot-renderer)'
    ].join(',');

    const ACTIVE_SELECTORS = isYouTube ? YT_AD_SELECTORS : AD_SELECTORS;

    function injectShield() {
        const style = document.createElement('style');
        const safeSelectors = ACTIVE_SELECTORS.split(',').map(s =>
            `${s}:not(#domain-intel-alert):not([id*="emputils"])`
        ).join(',');
        style.textContent = `${safeSelectors} { display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }`;
        (document.head || document.documentElement).appendChild(style);
    }

    function injectEasyListHideCSS(css) {
        if (!css) return;
        const style = document.createElement('style');
        style.id = 'emputils-easylist-hide';
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
    }

    function injectAnalyticsBlocker() {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('javascript/analytics-blocker-inject.js');
        script.setAttribute('data-whitelisted', 'false');
        script.onload = () => script.remove();
        (document.head || document.documentElement).prepend(script);
    }

    function hideInRoot(root) {
        root.querySelectorAll(ACTIVE_SELECTORS).forEach(el => el.style.setProperty('display', 'none', 'important'));
    }

    function pierceShadows(root) {
        hideInRoot(root);
        root.querySelectorAll('*').forEach(el => {
            if (el.shadowRoot) pierceShadows(el.shadowRoot);
        });
    }

    function setupSmartObserver() {
        const pending = [];
        let frameScheduled = false;

        function processPending() {
            frameScheduled = false;
            const nodes = pending.splice(0);
            for (const node of nodes) {
                if (node.matches(ACTIVE_SELECTORS)) {
                    node.style.setProperty('display', 'none', 'important');
                } else {
                    hideInRoot(node);
                }
                if (node.shadowRoot) pierceShadows(node.shadowRoot);
                node.querySelectorAll('*').forEach(child => {
                    if (child.shadowRoot) pierceShadows(child.shadowRoot);
                });
            }
        }

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    pending.push(node);
                }
            }
            if (!frameScheduled && pending.length > 0) {
                frameScheduled = true;
                requestAnimationFrame(processPending);
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

	function interceptResourceLoading() {
		const script = document.createElement('script');
		script.src = chrome.runtime.getURL('javascript/resource-blocker-inject.js');
		script.onload = () => script.remove();
		(document.head || document.documentElement).prepend(script);
	}

    function setupYouTubeAdSkipper() {
        let wasInAd = false;
        let savedMuted = null;

        function trySkip() {
            const video = document.querySelector('video');
            if (!video) return;

            const adActive = !!(
                document.querySelector('.ytp-ad-player-overlay') ||
                document.querySelector('#movie_player.ad-showing')
            );

            const skipBtn = document.querySelector(
                '.ytp-skip-ad-button, .ytp-ad-skip-button-container button'
            );
            if (skipBtn) skipBtn.click();

            if (adActive) {
                if (!wasInAd) {
                    wasInAd = true;
                    savedMuted = video.muted;
                }
                if (isFinite(video.duration) && video.duration > 0) {
                    video.currentTime = video.duration;
                } else if (video.playbackRate < 10) {
                    video.muted = true;
                    video.playbackRate = 10;
                }
            } else if (wasInAd) {
                wasInAd = false;
                video.playbackRate = 1;
                if (savedMuted !== null) {
                    video.muted = savedMuted;
                    savedMuted = null;
                }
            }
        }
        setInterval(trySkip, 300);
    }

    if (!isYouTube && !isRoblox) interceptResourceLoading();
    if (isYouTube) setupYouTubeAdSkipper();
    if (!isRoblox) injectShield();
    if (!isYouTube && !isRoblox) injectEasyListHideCSS(easyListHideCSS);
    if (!isYouTube && !isRoblox) injectAnalyticsBlocker();
    if (!isRoblox) setupSmartObserver();
    if (!isRoblox) pierceShadows(document);
})();
