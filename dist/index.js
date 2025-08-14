import { jsx, Fragment } from 'react/jsx-runtime';
import { useState, useEffect } from 'react';

class LRUCache {
    constructor(maxSize = 500, ttlHours = 1) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttl = ttlHours * 60 * 60 * 1000; // Convert to milliseconds
    }
    get(key) {
        const item = this.cache.get(key);
        if (!item)
            return undefined;
        // Check if item has expired
        if (Date.now() - item.timestamp > this.ttl) {
            this.cache.delete(key);
            return undefined;
        }
        // Move to end (LRU behavior)
        this.cache.delete(key);
        this.cache.set(key, item);
        return item.value;
    }
    set(key, value) {
        // Remove oldest item if cache is full
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }
        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
    }
    clear() {
        this.cache.clear();
    }
    size() {
        return this.cache.size;
    }
}

/**
 * CANONICAL Cache Key Generation Algorithm
 *
 * CRITICAL: This is the single source of truth for cache key generation.
 * The backend does NOT generate cache keys - it uses the key provided by this SDK.
 * This eliminates any risk of cache key drift between frontend and backend.
 */
function generateCacheKey(customerId, text, locale, context = '', tone = '') {
    // Step 1: Normalize ALL inputs to lowercase and trim
    const normalized = {
        c: customerId,
        t: text.trim().toLowerCase(),
        l: locale.toLowerCase(),
        ctx: context.trim().toLowerCase(),
        tn: tone.trim().toLowerCase()
    };
    // Step 2: Sort keys alphabetically to ensure consistent ordering
    const sortedKeys = Object.keys(normalized).sort();
    const sortedObj = {};
    sortedKeys.forEach(key => {
        sortedObj[key] = normalized[key];
    });
    // Step 3: Create JSON string
    const jsonString = JSON.stringify(sortedObj);
    // Step 4: Generate hash (using synchronous version for simplicity)
    return hashStringSync(jsonString);
}
/**
 * Synchronous version of hashString for compatibility
 */
function hashStringSync(str) {
    // Use simple hash for synchronous operation
    return simpleHash(str);
}
/**
 * Simple deterministic hash function
 * Not cryptographically secure, but good enough for cache keys
 */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    // Convert to positive hex string with padding
    const hex = Math.abs(hash).toString(16);
    return hex.length >= 8 ? hex : '0'.repeat(8 - hex.length) + hex;
}

class LiveI18n {
    constructor(config) {
        var _a;
        this.apiKey = config.apiKey;
        this.customerId = config.customerId;
        this.endpoint = config.endpoint || 'https://api.livei18n.com';
        this.defaultLanguage = config.defaultLanguage;
        this.showLoadingAnimation = (_a = config.showLoadingAnimation) !== null && _a !== void 0 ? _a : true; // Default to true
        this.cache = new LRUCache(500, 1); // 500 entries, 1 hour TTL
    }
    /**
     * Translate text using the LiveI18n API
     * Generates cache key and sends it to backend to eliminate drift
     */
    async translate(text, options) {
        // Input validation
        if (!text || text.length === 0)
            return text;
        if (text.length > 5000) {
            console.error('LiveI18n: Text exceeds 5000 character limit');
            return text;
        }
        const locale = (options === null || options === void 0 ? void 0 : options.language) || this.defaultLanguage || this.detectLocale();
        const tone = ((options === null || options === void 0 ? void 0 : options.tone) || '').substring(0, 50);
        const context = ((options === null || options === void 0 ? void 0 : options.context) || '').substring(0, 500);
        // Generate cache key using canonical algorithm
        const cacheKey = generateCacheKey(this.customerId, text, locale, context, tone);
        // Check local cache first
        const cached = this.cache.get(cacheKey);
        if (cached)
            return cached;
        try {
            const response = await fetch(`${this.endpoint}/api/v1/translate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.apiKey,
                    'X-Customer-ID': this.customerId,
                },
                body: JSON.stringify({
                    text: text.substring(0, 5000),
                    locale,
                    tone,
                    context,
                    cache_key: cacheKey, // Send cache key to backend
                }),
            });
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            const result = await response.json();
            // Cache the result locally
            this.cache.set(cacheKey, result.translated);
            // Log warnings for low confidence translations
            if (result.confidence < 0.7) {
                console.warn(`LiveI18n: Low confidence translation (${result.confidence}):`, {
                    original: text,
                    translated: result.translated,
                    locale
                });
            }
            return result.translated;
        }
        catch (error) {
            console.error('LiveI18n: Translation failed:', error);
            return text; // Fallback to original text
        }
    }
    /**
     * Submit feedback for a translation
     */
    async submitFeedback(originalText, translatedText, locale, rating, correction) {
        try {
            const response = await fetch(`${this.endpoint}/api/v1/feedback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.apiKey,
                    'X-Customer-ID': this.customerId,
                },
                body: JSON.stringify({
                    original_text: originalText,
                    translated_text: translatedText,
                    locale,
                    rating,
                    correction,
                }),
            });
            return response.ok;
        }
        catch (error) {
            console.error('LiveI18n: Failed to submit feedback:', error);
            return false;
        }
    }
    /**
     * Clear local cache
     */
    clearCache() {
        this.cache.clear();
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size(),
            maxSize: 500
        };
    }
    /**
     * Update the default language without re-initializing
     */
    updateDefaultLanguage(language) {
        this.defaultLanguage = language;
    }
    /**
     * Get the current default language
     */
    getDefaultLanguage() {
        return this.defaultLanguage;
    }
    /**
     * Check if loading animation is enabled
     */
    getShowLoadingAnimation() {
        return this.showLoadingAnimation;
    }
    /**
     * Detect browser locale
     */
    detectLocale() {
        if (typeof window !== 'undefined' && window.navigator) {
            return window.navigator.language || 'en-US';
        }
        return 'en-US';
    }
}

// Global instance
let globalInstance = null;
/**
 * Initialize the global LiveI18n instance
 * Must be called before using LiveText components
 */
function initializeLiveI18n(config) {
    globalInstance = new LiveI18n(config);
}
/**
 * Get the global LiveI18n instance
 * Logs error if not initialized instead of throwing
 */
function getLiveI18nInstance() {
    if (!globalInstance) {
        console.error('LiveI18n not initialized. Call initializeLiveI18n() first.');
        return null;
    }
    return globalInstance;
}
/**
 * Extract string content from React.ReactNode
 * Handles strings, numbers, arrays of strings/numbers, and filters out non-text content
 */
function extractStringContent(children) {
    if (typeof children === 'string') {
        return children;
    }
    if (typeof children === 'number') {
        return children.toString();
    }
    if (Array.isArray(children)) {
        return children
            .filter(child => typeof child === 'string' || typeof child === 'number')
            .map(child => typeof child === 'number' ? child.toString() : child)
            .join('');
    }
    // For other ReactNode types (React elements, fragments, etc.), 
    // try to convert to string but warn about potential issues
    if (children != null && typeof children === 'object') {
        console.warn('LiveText: Non-string React elements detected. Only string content will be translated.');
        return String(children);
    }
    return String(children || '');
}
const LiveText = ({ children, tone, context, language, fallback, onTranslationComplete, onError }) => {
    var _a;
    // Extract string content from children
    const textContent = extractStringContent(children);
    const [translated, setTranslated] = useState(textContent);
    const [isLoading, setIsLoading] = useState(false);
    useEffect(() => {
        if (!globalInstance) {
            console.error('LiveI18n not initialized. Call initializeLiveI18n() first.');
            return;
        }
        // Don't translate empty strings
        if (!textContent.trim()) {
            return;
        }
        setIsLoading(true);
        globalInstance
            .translate(textContent, { tone, context, language })
            .then((result) => {
            setTranslated(result);
            onTranslationComplete === null || onTranslationComplete === void 0 ? void 0 : onTranslationComplete(textContent, result);
        })
            .catch((error) => {
            console.error('LiveText translation failed:', error);
            setTranslated(fallback || textContent);
            onError === null || onError === void 0 ? void 0 : onError(error);
        })
            .finally(() => {
            setIsLoading(false);
        });
    }, [textContent, tone, context, language, fallback, onTranslationComplete, onError]);
    // Show loading state or translated text
    // Check if loading animation is enabled
    const showAnimation = (_a = globalInstance === null || globalInstance === void 0 ? void 0 : globalInstance.getShowLoadingAnimation()) !== null && _a !== void 0 ? _a : true;
    if (showAnimation && isLoading) {
        return (jsx("span", { className: "livei18n-text livei18n-loading", "aria-label": "Translating text...", role: "status", children: translated }));
    }
    if (showAnimation) {
        return (jsx("span", { className: "livei18n-text", children: translated }));
    }
    // No animation enabled - return text directly
    return jsx(Fragment, { children: translated });
};
/**
 * Hook for programmatic translation access
 */
function useLiveI18n() {
    const instance = getLiveI18nInstance();
    const translate = async (text, options) => {
        if (!instance) {
            console.warn('LiveI18n not initialized, returning original text');
            return text;
        }
        return instance.translate(text, options);
    };
    const submitFeedback = async (originalText, translatedText, locale, rating, correction) => {
        if (!instance) {
            console.warn('LiveI18n not initialized, feedback not submitted');
            return false;
        }
        return instance.submitFeedback(originalText, translatedText, locale, rating, correction);
    };
    return {
        translate,
        submitFeedback,
        defaultLanguage: instance === null || instance === void 0 ? void 0 : instance.getDefaultLanguage(),
        clearCache: () => instance === null || instance === void 0 ? void 0 : instance.clearCache(),
        getCacheStats: () => (instance === null || instance === void 0 ? void 0 : instance.getCacheStats()) || { size: 0, maxSize: 0 },
        updateDefaultLanguage: (language) => instance === null || instance === void 0 ? void 0 : instance.updateDefaultLanguage(language),
        getDefaultLanguage: () => instance === null || instance === void 0 ? void 0 : instance.getDefaultLanguage()
    };
}
/**
 * Update the default language of the global instance
 */
function updateDefaultLanguage(language) {
    const instance = getLiveI18nInstance();
    if (!instance) {
        console.warn('LiveI18n not initialized, cannot update default language');
        return;
    }
    instance.updateDefaultLanguage(language);
}
/**
 * Get the current default language of the global instance
 */
function getDefaultLanguage() {
    const instance = getLiveI18nInstance();
    if (!instance) {
        console.warn('LiveI18n not initialized, cannot get default language');
        return undefined;
    }
    return instance.getDefaultLanguage();
}

var LiveText$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    LiveText: LiveText,
    getDefaultLanguage: getDefaultLanguage,
    getLiveI18nInstance: getLiveI18nInstance,
    initializeLiveI18n: initializeLiveI18n,
    updateDefaultLanguage: updateDefaultLanguage,
    useLiveI18n: useLiveI18n
});

// Direct translate function for convenience
async function translate(text, options) {
    const { getLiveI18nInstance } = await Promise.resolve().then(function () { return LiveText$1; });
    const instance = getLiveI18nInstance();
    if (!instance) {
        console.warn('LiveI18n not initialized, returning original text');
        return text;
    }
    return instance.translate(text, options);
}
// Direct feedback function for convenience  
async function submitFeedback(originalText, translatedText, locale, rating, correction) {
    const { getLiveI18nInstance } = await Promise.resolve().then(function () { return LiveText$1; });
    const instance = getLiveI18nInstance();
    if (!instance) {
        console.warn('LiveI18n not initialized, feedback not submitted');
        return false;
    }
    return instance.submitFeedback(originalText, translatedText, locale, rating, correction);
}

export { LiveI18n, LiveText, getDefaultLanguage, getLiveI18nInstance, initializeLiveI18n, submitFeedback, translate, updateDefaultLanguage, useLiveI18n };
//# sourceMappingURL=index.js.map
