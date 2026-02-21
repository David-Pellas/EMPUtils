
const _ALERT_SET = new Set([
    // trackers / data brokers
    'doubleclick.net','scorecardresearch.com','quantserve.com','krxd.net',
    'adsafeprotected.com','2mdn.net','demdex.net','everesttech.net',
    'bluekai.com','atdmt.com','serving-sys.com','adnxs.com',
    'rlcdn.com','sitescout.com','crwdcntrl.net','exelator.com',
    'adform.net','w55c.net','turn.com','mathtag.com',
    'rubiconproject.com','rfihub.com','casalemedia.com','contextweb.com',
    'agkn.com','bidswitch.net','smartadserver.com','advertising.com',
    'nexac.com','revsci.net','adtech.de','criteo.com',
    'media.net','tapad.com','openx.net','pubmatic.com',
    'adsrvr.org','lijit.com','company-target.com','vertamedia.com',
    'ml314.com','exoclick.com','getblueshift.com','mediamath.com',
    'adroll.com','bizographics.com','eyeota.net','adsymptotic.com',
    '33across.com','zeotap.com','liadm.com','moatads.com',
    'ads-twitter.com','connect.facebook.net','snapads.com','ad-delivery.net',
    // analytics
    'google-analytics.com','googletagmanager.com','hotjar.com','segment.com',
    'mixpanel.com','amplitude.com','newrelic.com','sentry.io',
    'segment.io','mxpnl.com','nr-data.net','fullstory.com',
    'loggly.com','bugsnag.com','rollbar.com','trackjs.com',
    'heap.io','heapanalytics.com','pendo.io','appcues.com',
    'intercom.io','intercom.com','drift.com','olark.com',
    'zopim.com','livechatinc.com','tawk.to','crisp.chat',
    'mouseflow.com','luckyorange.com','inspectlet.com','sessioncam.com',
    'quantummetric.com','contentsquare.net','dynatrace.com','datadoghq.com',
    'splunk.com','appdynamics.com','elastic.co','logz.io',
    'sumologic.com','raygun.com','airbrake.io','honeybadger.io',
    'optimizely.com','vwo.com','crazyegg.com','clicktale.net',
    'smartlook.com','logrocket.com','clicky.com','statcounter.com',
    'chartbeat.com','clarity.ms','matomo.cloud','contentsquare.com','qualtrics.com',
    // ads
    'googlesyndication.com','outbrain.com','taboola.com','revcontent.com',
    'mgid.com','gravity.com','sharethrough.com','yieldmo.com','nativo.com',
    'triplelift.com','sovrn.com','aol.com','yahoo.com','bing.com',
    'baidu.com','yandex.ru','amazon-adsystem.com','a9.com','aps.amazon.com',
    'indexexchange.com','improvedigital.com','smaato.com','xandr.com','adform.com',
    'spotxchange.com','springserve.com','telaria.com','rhythmone.com',
    'undertone.com','conversantmedia.com','mediavine.com','adthrive.com',
    'monumetric.com','ezoic.com','sonobi.com','kargo.com',
    'adskeeper.com','propellerads.com','popcash.net','popads.net',
    'adsterra.com','hilltopads.com','magnite.com','indexww.com','teads.tv',
    // social
    'facebook.com','facebook.net','fbcdn.net','instagram.com',
    'twitter.com','t.co','twimg.com','linkedin.com','licdn.com',
    'pinterest.com','pinimg.com','tiktok.com','ttwstatic.com',
    'youtube.com','ytimg.com','snapchat.com','sc-cdn.net',
    'reddit.com','redd.it','redditmedia.com','redditstatic.com',
    'tumblr.com','tumblr.co','t.umblr.com','whatsapp.com',
    'telegram.org','t.me','discord.com','discordapp.com',
    'vk.com','vkontakte.ru','weibo.com','weibocdn.com',
    'line.me','line.naver.jp','medium.com','twitch.tv',
    'ttvnw.net','vimeo.com','vimeocdn.com','dailymotion.com',
    'flickr.com','staticflickr.com','meetup.com','xing.com',
    'slideshare.net','behance.net','dribbble.com','producthunt.com',
    'substack.com','patreon.com',
]);

const _RISK_KW = ['pixel','track','analyze','metrics','ads','telemetry'];

function getLocalRisk(domain) {
    const lower = domain.toLowerCase();
    const parts = lower.split('.');
    for (let i = 0; i < parts.length - 1; i++) {
        if (_ALERT_SET.has(parts.slice(i).join('.'))) return 'high';
    }
    if (_RISK_KW.some(w => lower.includes(w))) return 'high';
    return 'low';
}

async function checkPageRisk() {
    const currentDomain = window.location.hostname;
    const data = await chrome.storage.local.get(['allowedPopups', 'disabledTrackers', 'allowAlerts']);
    const allowedPopups = data.allowedPopups || [];
    const disabledTrackers = data.disabledTrackers || [];
    const alertsEnabled = data.allowAlerts !== false;

    if (allowedPopups.includes(currentDomain)) {
        console.log("EMPUtils: Alerts muted. Tracker blocking and deletion disabled for this domain.");
        return;
    }

    const elements = Array.from(document.querySelectorAll('script[src], link[rel="stylesheet"], iframe[src]'));
    let highRiskTrackers = [];
    const seen = new Set();

    elements.forEach(el => {
        const src = el.src || el.href;
        try {
            const url = new URL(src);
            const hostname = url.hostname;
            
            if (disabledTrackers.includes(hostname)) {
                el.remove();
                return;
            }

            if (hostname !== currentDomain && !seen.has(hostname)) {
                seen.add(hostname);
                if (getLocalRisk(hostname) === 'high') {
                    highRiskTrackers.push(hostname);
                }
            }
        } catch (e) {}
    });

    // Only show the alert banner if alerts are enabled, don't forget to check cache data
    if (alertsEnabled && highRiskTrackers.length > 0) {
        showRiskNotification(highRiskTrackers.length, currentDomain, highRiskTrackers);
    }
}

async function showRiskNotification(count, currentDomain, trackersFound) {
    if (document.getElementById('domain-intel-alert')) return;

    const prefs = await chrome.storage.local.get(['alertDuration', 'themeColor']);
    const durationSec = prefs.alertDuration || 3;
    const themeColor = prefs.themeColor || '#2563eb';

    const alertDiv = document.createElement('div');
    alertDiv.id = 'domain-intel-alert';
    alertDiv.style.setProperty('--emp-theme', themeColor);

    alertDiv.innerHTML = `
        <div class="emp-alert-inner">
            <div class="emp-alert-header">
                <span class="emp-alert-badge">EMPUtils &middot; Tracker Advisory</span>
                <span id="close-intel-alert">&times;</span>
            </div>
            <p class="emp-alert-text">
                <strong class="emp-alert-count">${count}</strong>
                high-risk tracker${count > 1 ? 's' : ''} detected on this page.
            </p>
            <div class="emp-alert-footer">
                <a href="#" id="emp-silence-alerts" class="emp-btn-whitelist">Whitelist this Site</a>
                <a href="#" id="block-trackers" class="emp-btn-block">Block All Trackers</a>
            </div>
        </div>
        <div class="intel-progress-container">
            <div id="intel-bar" class="intel-progress-bar"
                 style="animation-duration:${durationSec}s; background:${themeColor};">
            </div>
        </div>
    `;
    document.body.appendChild(alertDiv);

    const autoCloseTimeout = setTimeout(() => {
        closeAlert();
    }, durationSec * 1000);

    function closeAlert() {
        alertDiv.classList.add('alert-fade-out');
        setTimeout(() => {
            if (alertDiv.parentNode) alertDiv.remove();
        }, 500);
    }

    document.getElementById('close-intel-alert').onclick = () => {
        clearTimeout(autoCloseTimeout);
        closeAlert();
    };

    document.getElementById('emp-silence-alerts').onclick = async (e) => {
        e.preventDefault();
        const currentDomain = window.location.hostname;

        const data = await chrome.storage.local.get('allowedPopups');
        const list = data.allowedPopups || [];
        if (!list.includes(currentDomain)) list.push(currentDomain);
        await chrome.storage.local.set({ allowedPopups: list });

        chrome.runtime.sendMessage({ 
            type: "WHITELIST_DOMAIN", 
            domain: currentDomain 
        }, () => {
            closeAlert();
            location.reload(); 
        });
    };

    document.getElementById('block-trackers').onclick = async (e) => {
        e.preventDefault();
        clearTimeout(autoCloseTimeout);
        const data = await chrome.storage.local.get('disabledTrackers');
        const list = data.disabledTrackers || [];
        trackersFound.forEach(t => {
            if (!list.includes(t)) list.push(t);
        });
        await chrome.storage.local.set({ disabledTrackers: list });
        alertDiv.remove();
        location.reload(); 
    };
}

if (document.readyState === 'complete') {
    checkPageRisk();
} else {
    window.addEventListener('load', checkPageRisk);
}