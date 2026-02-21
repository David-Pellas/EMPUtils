(function() {
    const AD_URL_PATTERNS = [
        '/ads/', '/ad/', 'banner', '/sponsored', '/promo/',
        'doubleclick', 'googlesyndication', 'adservice',
        'adnxs', 'moatads', 'connatix', 'outbrain', 'taboola',
        'bugsnag.com', 'sentry.io'
    ];

    function isAdUrl(url) {
        if (!url) return false;
        const lower = url.toLowerCase();
        return AD_URL_PATTERNS.some(p => lower.includes(p));
    }

    const NativeImage = window.Image;
    window.Image = function(...args) {
        const img = new NativeImage(...args);
        const descriptor = Object.getOwnPropertyDescriptor(NativeImage.prototype, 'src');
        Object.defineProperty(img, 'src', {
            set(value) {
                if (isAdUrl(value)) return;
                descriptor.set.call(this, value);
            },
            get() { return descriptor.get.call(this); },
            configurable: true
        });
        return img;
    };

    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
        const url = typeof input === 'string' ? input : input?.url;
        if (isAdUrl(url)) return Promise.reject(new Error('Blocked by EMPUtils'));
        if (init?.headers) {
            const h = new Headers(init.headers);
            if (h.has('sentry-trace') || h.has('baggage')) {
                h.delete('sentry-trace');
                h.delete('baggage');
                return originalFetch.call(this, input, { ...init, headers: h });
            }
        }
        return originalFetch.apply(this, arguments);
    };

    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        if (isAdUrl(url)) { this._blocked = true; return; }
        return originalOpen.call(this, method, url, ...rest);
    };

    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
        const lower = name.toLowerCase();
        if (lower === 'sentry-trace' || lower === 'baggage') return;
        return originalSetRequestHeader.call(this, name, value);
    };

    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(...args) {
        if (this._blocked) return;
        return originalSend.apply(this, args);
    };
})();