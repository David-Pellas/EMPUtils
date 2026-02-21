(function() {
    'use strict';

    const currentScript = document.currentScript;
    const isWhitelisted = currentScript && currentScript.getAttribute('data-whitelisted') === 'true';

    if (isWhitelisted) {
        console.log("[EMPUtils] Tracker Proxy: ABORTED (Whitelisted)");
        return; // ABSOLUTELY DO NOT TOUCH PROTOTYPES
    }

    const silentHandler = {
        get: (_target, prop) => {

            if (prop === Symbol.toPrimitive) return () => "";
            if (prop === 'toString' || prop === 'valueOf') return () => "";
            if (prop === 'constructor') return Object;
            return trackerProxy;
        },
        apply: () => trackerProxy,
        construct: () => trackerProxy
    };

    const trackerProxy = new Proxy(() => {}, silentHandler);
    const globals = ['ga', 'gtag', 'dataLayer', 'hj', 'ym', 'fbq', 'googletag', 'Sentry', 'bugsnag', 'Bugsnag', 'swfobject', 'flashembed', 'AC_FL_RunContent'];

    globals.forEach(name => {
    try {
        Object.defineProperty(window, name, {
            get: () => trackerProxy,
            set: () => true,
            configurable: true
        });
    } catch (e) {
        // Property is non-configurable
        try {
            window[name] = trackerProxy;
        } catch (e2) {
            // Can't override at all, skip silently
        }
    }
});

    // Intercept script creation
    const originalCreateElement = document.createElement;
    document.createElement = function(tagName) {
        const element = originalCreateElement.call(document, tagName);
        if (tagName.toLowerCase() === 'script') {
            const originalSetAttribute = element.setAttribute;
            element.setAttribute = function(name, value) {
                const blocked = ['google-analytics', 'googletagmanager', 'hotjar', 'sentry', 'bugsnag'];
                if (name.toLowerCase() === 'src' && blocked.some(p => String(value).toLowerCase().includes(p))) {
                    originalSetAttribute.call(this, 'type', 'javascript/blocked');
                }
                return originalSetAttribute.call(this, name, value);
            };
        }
        return element;
    };
})();