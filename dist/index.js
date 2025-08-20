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
        this.apiKey = config.apiKey;
        this.customerId = config.customerId;
        this.endpoint = config.endpoint || 'https://api.livei18n.com';
        this.defaultLanguage = config.defaultLanguage;
        this.cache = new LRUCache(500, 1); // 500 entries, 1 hour TTL
    }
    /**
     * Sleep for a given number of milliseconds
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Make a single translation request attempt
     */
    async makeTranslationRequest(text, locale, tone, context, cacheKey) {
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
                cache_key: cacheKey,
            }),
        });
        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    }
    /**
     * Translate text using the LiveI18n API with retry logic
     * Generates cache key and sends it to backend to eliminate drift
     * Retries up to 5 times with exponential backoff, max 5 seconds total
     */
    async translate(text, options, onRetry) {
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
        const maxRetries = 5;
        const baseDelay = 100; // Start with 100ms
        const maxTotalTime = 5000; // 5 seconds total limit
        const startTime = Date.now();
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            // Check if we've exceeded the total time limit
            if (Date.now() - startTime >= maxTotalTime) {
                console.warn(`LiveI18n: Translation timeout after ${maxTotalTime}ms`);
                break;
            }
            try {
                if (attempt > 0 && onRetry) {
                    onRetry(attempt);
                }
                const result = await this.makeTranslationRequest(text, locale, tone, context, cacheKey);
                // Cache the result locally
                this.cache.set(cacheKey, result.translated);
                // Log warnings for low confidence translations
                if (result.confidence < 0.4) {
                    console.warn(`LiveI18n: Low confidence translation (${result.confidence}):`, {
                        original: text,
                        translated: result.translated,
                        locale
                    });
                }
                // Log successful retry if not first attempt
                if (attempt > 0) {
                    console.log(`LiveI18n: Translation succeeded on attempt ${attempt + 1}`);
                }
                return result.translated;
            }
            catch (error) {
                const isLastAttempt = attempt === maxRetries - 1;
                const timeElapsed = Date.now() - startTime;
                if (isLastAttempt || timeElapsed >= maxTotalTime) {
                    console.error(`LiveI18n: Translation failed after ${attempt + 1} attempts:`, error);
                    return text; // Fallback to original text
                }
                // Calculate delay with exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
                const delay = Math.min(baseDelay * Math.pow(2, attempt), 1600);
                // Ensure we don't exceed the total time limit with the delay
                const remainingTime = maxTotalTime - timeElapsed;
                const actualDelay = Math.min(delay, remainingTime - 100); // Leave 100ms for the request
                if (actualDelay > 0) {
                    console.warn(`LiveI18n: Attempt ${attempt + 1} failed, retrying in ${actualDelay}ms:`, error);
                    await this.sleep(actualDelay);
                }
            }
        }
        // Should not reach here, but fallback just in case
        return text;
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
    // Extract string content from children
    const textContent = extractStringContent(children);
    const [translated, setTranslated] = useState(textContent);
    const [isLoading, setIsLoading] = useState(true);
    const [attempts, setAttempts] = useState(0);
    useEffect(() => {
        // if we are on a second attempt set loading to false
        // thhis way we can show the original text and exit the loading animation early
        // while we keep attempting translation ini the background
        if (attempts > 0 && isLoading) {
            setIsLoading(false);
        }
    }, [attempts]);
    useEffect(() => {
        if (!globalInstance) {
            setIsLoading(false);
            console.error('LiveI18n not initialized. Call initializeLiveI18n() first.');
            return;
        }
        // Don't translate empty strings
        if (!textContent.trim()) {
            setIsLoading(false);
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
    return {
        translate,
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

export { LiveI18n, LiveText, getDefaultLanguage, getLiveI18nInstance, initializeLiveI18n, translate, updateDefaultLanguage, useLiveI18n };
//# sourceMappingURL=index.js.map
